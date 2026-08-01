import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { BadRequestException, type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { hashPassword } from "better-auth/crypto";
import { eq, inArray, like, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminDb, schema, type Db } from "@langopia/db";
import { AppModule } from "../../src/app.module.js";
import { CLOCK, type Clock } from "../../src/contexts/shared/domain/ports/clock.port.js";
import {
  PAYMENT_GATEWAY,
  PaymentProvider,
  type ChargeResult,
  type PaymentGatewayPort,
  type PaymentStatus,
  type RefundResult,
} from "../../src/contexts/billing/domain/ports/payment-gateway.port.js";

/**
 * Tarea 10 de la ola 1: el criterio de «listo» del spec, automatizado.
 *
 * Recorre TODOS los contextos de la ola con peticiones HTTP reales contra el
 * `AppModule` completo (guardias, filtros, CQRS, Postgres real vía
 * `DATABASE_URL_APP`/RLS) — nada de dobles de infraestructura salvo los dos
 * descritos abajo, que sustituyen justo lo que esta prueba no debe ejercitar
 * de verdad. No es una prueba unitaria más (esas ya sobran 461): es el
 * camino de un dueño de escuela real, de principio a fin.
 *
 * Dos sustituciones deliberadas, ambas documentadas en el informe:
 *
 *   1. `CLOCK`: por un reloj controlable. Programar clases exige `startsAt`
 *      futuro y pasar lista exige que la clase ya haya empezado — con el
 *      reloj de verdad, «programar una semana y pasar lista de todas»
 *      significaría esperar días reales. El reloj es el MISMO para toda la
 *      aplicación (es un provider `@Global()` de `SharedModule`), así que
 *      facturas, auditoría e impersonación usan la misma hora simulada que
 *      `scheduling` — nada queda descoordinado.
 *   2. `PAYMENT_GATEWAY`: por un doble que resuelve como Stripe en modo
 *      prueba (siempre `succeeded`, referencias `pi_e2e_*`/`re_e2e_*`), sin
 *      tocar la red. La única implementación real en este repo
 *      (`StripePaymentGatewayAdapter`) exige `STRIPE_SECRET_KEY` y llama a
 *      `api.stripe.com` de verdad — inviable en CI y no es lo que esta
 *      prueba quiere ejercitar. El comando (`RecordPaymentHandler`,
 *      `RefundPaymentHandler`) es exactamente el mismo que correría con
 *      claves de prueba reales de Stripe.
 *
 * Todo lo demás es la aplicación real: nadie más sustituye nada.
 */

class ControllableClock implements Clock {
  private current: Date;

  constructor(start: Date) {
    this.current = start;
  }

  now(): Date {
    return this.current;
  }

  advanceDays(days: number): void {
    this.current = new Date(this.current.getTime() + days * 24 * 60 * 60 * 1000);
  }
}

/** Ver el comentario de cabecera: nunca habla con Stripe de verdad. */
class FakeStripeGateway implements PaymentGatewayPort {
  private sequence = 0;

  async charge(): Promise<ChargeResult> {
    this.sequence += 1;
    return {
      status: "succeeded",
      charge: { provider: PaymentProvider.Stripe, ref: `pi_e2e_${this.sequence}` },
    };
  }

  async refund(): Promise<RefundResult> {
    this.sequence += 1;
    return {
      status: "succeeded",
      refund: { provider: PaymentProvider.Stripe, ref: `re_e2e_${this.sequence}` },
    };
  }

  async statusOf(): Promise<PaymentStatus> {
    return "succeeded";
  }
}

/* ────────────────────────────── Cliente HTTP mínimo ─────────────────────── */

type Json = Record<string, any>;

interface ApiResult {
  status: number;
  body: Json;
  /** `Cookie:` ya lista para reenviar, o `null` si la respuesta no fijó ninguna. */
  cookie: string | null;
}

/** Better Auth manda varias `Set-Cookie` a la vez; se reenvían todas juntas. */
function mergeCookies(setCookie: readonly string[]): string {
  return setCookie.map((one) => one.split(";")[0]!).join("; ");
}

async function call(
  baseUrl: string,
  method: string,
  path: string,
  options: { cookie?: string; body?: unknown } = {},
): Promise<ApiResult> {
  const headers: Record<string, string> = {};
  if (options.cookie) headers["cookie"] = options.cookie;
  if (options.body !== undefined) headers["content-type"] = "application/json";

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const setCookie = response.headers.getSetCookie();
  const text = await response.text();
  const body = text.length > 0 ? JSON.parse(text) : {};

  return {
    status: response.status,
    body,
    cookie: setCookie.length > 0 ? mergeCookies(setCookie) : null,
  };
}

/* ────────────────────────────── Credenciales de prueba ──────────────────── */

/**
 * Crea una credencial de Better Auth ya verificada, sin pasar por el flujo
 * de correo real (que en desarrollo solo escribe el enlace en el registro y
 * en producción no envía nada — ninguno de los dos es programáticamente
 * observable desde una prueba automatizada). Mismo patrón, exactamente, que
 * `packages/db/src/seed/credentials.ts`: es la única vía que este propio
 * repositorio demuestra para tener una sesión de Better Auth verificada sin
 * bandeja de entrada.
 */
async function createBetterAuthCredential(
  db: Db,
  params: { email: string; name: string; password: string },
): Promise<string> {
  const authUserId = randomUUID();
  const now = new Date();
  const hash = await hashPassword(params.password);

  await db.insert(schema.authUsers).values({
    id: authUserId,
    name: params.name,
    email: params.email,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.authAccounts).values({
    id: randomUUID(),
    accountId: authUserId,
    providerId: "credential",
    userId: authUserId,
    password: hash,
    createdAt: now,
    updatedAt: now,
  });

  return authUserId;
}

/**
 * Persona de soporte de la plataforma (Tarea 17): fila global en `users`,
 * SIN escuela, más `platform_support_staff` — mismo patrón que
 * `seedPlatformSupport`/`seedCredentials`. Es quien impersona en el paso 11.
 */
async function createPlatformSupportPersona(
  db: Db,
  params: { email: string; name: string; password: string },
): Promise<void> {
  const now = new Date();
  const [user] = await db
    .insert(schema.users)
    .values({
      email: params.email,
      name: params.name,
      locale: "es-ES",
      timezone: "Europe/Madrid",
      authProvider: "password",
      emailVerifiedAt: now,
      lastSeenAt: now,
    })
    .returning();
  if (!user) throw new Error("No se pudo crear la persona de soporte de plataforma.");

  await db.insert(schema.platformSupportStaff).values({ userId: user.id });

  const authUserId = await createBetterAuthCredential(db, params);
  await db.update(schema.users).set({ authUserId }).where(eq(schema.users.id, user.id));
}

function dateYearsAgo(years: number, from: Date): string {
  const d = new Date(from);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

/**
 * `OnClassSessionCanceled` (billing) reacciona al evento de cancelación
 * DESPUÉS de que la petición HTTP ya haya respondido —`EventBus.publish` de
 * `@nestjs/cqrs` no espera a que termine el manejador—, así que la
 * devolución no tiene por qué existir todavía cuando `POST .../cancel`
 * devuelve 200. Se sondea en vez de asumir instantáneo.
 */
async function waitUntil<T>(
  fn: () => Promise<T | null | undefined>,
  options: { label: string; timeoutMs?: number; intervalMs?: number },
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const intervalMs = options.intervalMs ?? 100;
  const startedAt = Date.now();
  for (;;) {
    const result = await fn();
    if (result !== null && result !== undefined) return result;
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Se agotó la espera de «${options.label}».`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/* ────────────────────────────── La prueba ────────────────────────────────── */

// Identificador único por ejecución: la prueba crea su propia escuela y
// personas (correos únicos), así que corre igual contra una base de datos
// vacía recién desplegada que contra el Postgres de desarrollo ya sembrado
// (paso 2 del brief) — nunca choca con las 3 escuelas del seed ni con una
// ejecución anterior de esta misma prueba.
const RUN = randomUUID().slice(0, 8);
const EMAIL_DOMAIN = `e2e-${RUN}.langopia.test`;

describe("Ola 1 — recorrido de extremo a extremo (Tarea 10)", () => {
  let app: INestApplication;
  let baseUrl: string;
  let adminDb: Db;
  let closeAdminDb: () => Promise<void>;
  let clock: ControllableClock;

  const startedAt = new Date();

  beforeAll(async () => {
    clock = new ControllableClock(startedAt);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CLOCK)
      .useValue(clock)
      .overrideProvider(PAYMENT_GATEWAY)
      .useValue(new FakeStripeGateway())
      .compile();

    app = moduleRef.createNestApplication();

    // Mismo `ValidationPipe` que `main.ts`: si algún día diverge, esta
    // prueba deja de reflejar lo que corre en producción.
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        exceptionFactory: (errors) =>
          new BadRequestException({
            message: "validation_failed",
            errors: errors.flatMap((error) =>
              Object.values(error.constraints ?? {}).map((message) => ({
                field: error.property,
                message,
              })),
            ),
          }),
      }),
    );
    app.setGlobalPrefix("api/v1");

    // Puerto 0: el sistema operativo asigna uno libre. No tumba el servidor
    // de ningún otro agente ni depende de que un puerto fijo esté vacante.
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

    const admin = createAdminDb();
    adminDb = admin.db;
    closeAdminDb = () => admin.client.end({ timeout: 5 });
  });

  afterAll(async () => {
    await app?.close();
    await closeAdminDb?.();
  });

  it(
    "recorre alta de escuela, matrícula, clases, facturación, cobro, cancelación con devolución y bloqueo de RGPD durante impersonación",
    async () => {
      /* ---- Paso 1: crear escuela y dueño --------------------------------- */

      const ownerEmail = `duena@${EMAIL_DOMAIN}`;
      const ownerPassword = "Recorrido-e2e-2026!";
      await createBetterAuthCredential(adminDb, {
        email: ownerEmail,
        name: "Marina Duarte",
        password: ownerPassword,
      });

      const ownerSignIn = await call(baseUrl, "POST", "/auth/sign-in/email", {
        body: { email: ownerEmail, password: ownerPassword },
      });
      expect(ownerSignIn.status).toBe(200);
      const ownerCookie = ownerSignIn.cookie;
      if (!ownerCookie) throw new Error("El alta de la dueña no dejó cookie de sesión.");

      const registered = await call(baseUrl, "POST", "/schools/register", {
        cookie: ownerCookie,
        body: { slug: `e2e-${RUN}`, name: "Academia E2E Ola 1" },
      });
      expect(registered.status).toBe(201);
      const schoolId = registered.body.schoolId as string;
      expect(schoolId).toBeTruthy();

      // Comerciante activo y comisión del 2 %: no hay ningún endpoint que
      // deje la escuela lista para cobrar sin hablar con Stripe de verdad
      // (el alta de comerciante, Tarea 8, llama a su API real). Se deja tal
      // y como lo dejaría un alta de comerciante completada — igual que hace
      // el seed (`packages/db/src/seed/scenarios/atlantico.ts`) — para poder
      // probar el cobro y la comisión sin credenciales reales.
      await adminDb.execute(sql`
        UPDATE schools
        SET merchant_status = 'active',
            merchant_ref = ${`acct_e2e_${RUN}`},
            application_fee_enabled = true,
            application_fee_bps = 200
        WHERE id = ${schoolId}
      `);

      /* ---- Paso 2: 30 alumnos, 5 menores con tutor ----------------------- */

      const TOTAL_STUDENTS = 30;
      const MINORS = 5;
      const students: Array<{ studentId: string; email: string; guardianRequired: boolean }> = [];

      for (let i = 0; i < TOTAL_STUDENTS; i += 1) {
        const isMinor = i < MINORS;
        const email = `alumno${String(i).padStart(2, "0")}@${EMAIL_DOMAIN}`;
        const body: Json = {
          name: `Alumno E2E ${i}`,
          email,
          dateOfBirth: isMinor ? dateYearsAgo(10, startedAt) : dateYearsAgo(28, startedAt),
          nativeLanguage: "es",
          targetLanguage: "en",
          locale: "es-ES",
        };
        if (isMinor) {
          body.guardian = {
            name: `Tutor E2E ${i}`,
            email: `tutor${String(i).padStart(2, "0")}@${EMAIL_DOMAIN}`,
            relationship: "mother",
          };
        }

        const res = await call(baseUrl, "POST", "/students", { cookie: ownerCookie, body });
        expect(res.status).toBe(201);
        expect(res.body.guardianRequired).toBe(isMinor);
        students.push({
          studentId: res.body.studentId as string,
          email,
          guardianRequired: res.body.guardianRequired as boolean,
        });
      }

      expect(students.filter((s) => s.guardianRequired).length).toBe(MINORS);

      /* ---- Paso 3: 3 profesores con disponibilidad ----------------------- */

      const teachers: Array<{ teacherId: string }> = [];
      for (let t = 0; t < 3; t += 1) {
        const hire = await call(baseUrl, "POST", "/teachers", {
          cookie: ownerCookie,
          body: {
            name: `Profesora E2E ${t}`,
            email: `profesora${t}@${EMAIL_DOMAIN}`,
            tier: "professional",
            hourlyRateCents: 2500,
            contractedHoursPerWeek: 20,
            hiredAt: dateYearsAgo(2, startedAt),
            locale: "es-ES",
          },
        });
        expect(hire.status).toBe(201);
        const teacherId = hire.body.teacherId as string;

        // Disponibilidad real, sí ejercida — pero el paso 6 programa con
        // `overrideAvailability: true` para no depender de que el día de la
        // semana / hora reales en que corra esta prueba encajen con la
        // franja declarada aquí. Ver informe, decisión sobre zona horaria.
        const availability = await call(baseUrl, "PUT", `/teachers/${teacherId}/availability`, {
          cookie: ownerCookie,
          body: {
            slots: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMinute: 480, endMinute: 1200 })),
          },
        });
        expect(availability.status).toBe(200);
        expect(availability.body.slots).toBe(5);

        teachers.push({ teacherId });
      }

      /* ---- Paso 4: 2 cursos y 3 grupos ------------------------------------ */

      const courseA = await call(baseUrl, "POST", "/courses", {
        cookie: ownerCookie,
        body: {
          code: `ING-B1-${RUN}`,
          language: "en",
          level: "B1",
          modality: "group",
          maxStudents: 15,
          priceCents: 8000,
          currency: "EUR",
          translations: [{ locale: "es-ES", name: "Inglés B1 grupo" }],
        },
      });
      expect(courseA.status).toBe(201);

      const courseB = await call(baseUrl, "POST", "/courses", {
        cookie: ownerCookie,
        body: {
          code: `FRA-A1-${RUN}`,
          language: "fr",
          level: "A1",
          modality: "group",
          maxStudents: 15,
          priceCents: 7000,
          currency: "EUR",
          translations: [{ locale: "es-ES", name: "Francés A1 grupo" }],
        },
      });
      expect(courseB.status).toBe(201);

      const groupDefs = [
        { courseId: courseA.body.courseId as string, teacherId: teachers[0]!.teacherId, name: "Inglés B1 — grupo 1" },
        { courseId: courseA.body.courseId as string, teacherId: teachers[1]!.teacherId, name: "Inglés B1 — grupo 2" },
        { courseId: courseB.body.courseId as string, teacherId: teachers[2]!.teacherId, name: "Francés A1 — grupo 1" },
      ];

      const groups: Array<{ groupId: string; teacherId: string; studentIds: string[] }> = [];
      for (const def of groupDefs) {
        const res = await call(baseUrl, "POST", "/groups", {
          cookie: ownerCookie,
          body: {
            courseId: def.courseId,
            teacherId: def.teacherId,
            name: def.name,
            startsOn: startedAt.toISOString().slice(0, 10),
          },
        });
        expect(res.status).toBe(201);
        groups.push({ groupId: res.body.groupId as string, teacherId: def.teacherId, studentIds: [] });
      }

      /* ---- Paso 5: matricular a los 30 ------------------------------------ */

      const GROUP_SIZE = 10;
      for (let i = 0; i < TOTAL_STUDENTS; i += 1) {
        const group = groups[Math.floor(i / GROUP_SIZE)]!;
        const student = students[i]!;
        const res = await call(baseUrl, "POST", `/groups/${group.groupId}/enrolments`, {
          cookie: ownerCookie,
          body: { studentId: student.studentId },
        });
        expect(res.status).toBe(201);
        group.studentIds.push(student.studentId);
      }
      for (const g of groups) expect(g.studentIds.length).toBe(GROUP_SIZE);

      /* ---- Paso 6: programar una semana de clases (lunes a viernes) ------- */

      const DAYS = 5;
      // sessions[grupo][día] — día 0 = lunes ... día 4 = viernes.
      const sessions: string[][] = groups.map(() => []);
      for (let g = 0; g < groups.length; g += 1) {
        const group = groups[g]!;
        for (let day = 1; day <= DAYS; day += 1) {
          const startsAtDate = new Date(startedAt.getTime() + day * 24 * 60 * 60 * 1000);
          const res = await call(baseUrl, "POST", "/scheduling/sessions", {
            cookie: ownerCookie,
            body: {
              groupId: group.groupId,
              teacherId: group.teacherId,
              startsAt: startsAtDate.toISOString(),
              durationMinutes: 60,
              roomProvider: "livekit",
              // `Room.of()` exige un enlace de conexión para todo proveedor
              // salvo presencial — LiveKit incluido, solo se libra del
              // identificador externo.
              roomUrl: "https://video.langopia.test/e2e",
              overrideAvailability: true,
            },
          });
          expect(res.status).toBe(201);
          sessions[g]!.push(res.body.sessionId as string);
        }
      }

      // La clase que se cancelará en el paso 10: la última de la semana del
      // primer grupo. A propósito NO se le pasa lista antes: una hoja de
      // asistencia completa cierra la clase (`OnAttendanceRecorded` llama a
      // `ClassSession.complete()`) y una clase cerrada ya no se puede
      // cancelar (`assertOpen`) — así que tiene que quedar «scheduled».
      const cancelCandidateSessionId = sessions[0]![DAYS - 1]!;

      /* ---- Paso 7: pasar lista de las clases que ya han tenido lugar ------ */

      // Reloj CONTROLADO (no el real, ver cabecera del fichero): se avanza
      // más allá de toda la semana programada para pasar lista sin esperar
      // días de verdad.
      clock.advanceDays(DAYS + 1);

      let attendanceRecorded = 0;
      for (let g = 0; g < groups.length; g += 1) {
        const group = groups[g]!;
        for (let day = 0; day < DAYS; day += 1) {
          if (g === 0 && day === DAYS - 1) continue; // la reservada para el paso 10
          const sessionId = sessions[g]![day]!;
          const res = await call(baseUrl, "POST", `/scheduling/sessions/${sessionId}/attendance`, {
            cookie: ownerCookie,
            body: {
              entries: group.studentIds.map((studentId) => ({ studentId, status: "present" as const })),
            },
          });
          expect(res.status).toBe(200);
          expect(res.body.recorded).toBe(group.studentIds.length);
          attendanceRecorded += res.body.recorded as number;
        }
      }
      // 3 grupos × 10 alumnos, salvo el grupo 0 al que le falta un día:
      // (3×5 − 1) × 10 = 140.
      expect(attendanceRecorded).toBe(140);

      const attendanceInDb = await adminDb.execute<{ count: string }>(sql`
        SELECT count(*)::text AS count FROM attendance WHERE school_id = ${schoolId} AND status = 'present'
      `);
      expect(Number(attendanceInDb[0]?.count)).toBe(140);

      /* ---- Paso 8: emitir las facturas del mes ---------------------------- */

      // Alumna adulta del grupo 0: su factura del mes llevará además la
      // línea de la clase que se cancelará en el paso 10, para poder
      // comprobar que la devolución automática toca justo esa línea y no la
      // factura entera.
      const specialStudentIndex = 5;
      const SESSION_LINE_CENTS = 3000;
      const dueOn = new Date(clock.now().getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();

      const invoices: Array<{ invoiceId: string; studentIndex: number; totalCents: number }> = [];

      for (let i = 0; i < TOTAL_STUDENTS; i += 1) {
        const student = students[i]!;
        const lines: Json[] = [
          { description: "Mensualidad de idiomas", quantity: 1, unitCents: 8000 },
        ];
        if (i === specialStudentIndex) {
          lines.push({
            description: "Clase individual de recuperación",
            quantity: 1,
            unitCents: SESSION_LINE_CENTS,
            sessionId: cancelCandidateSessionId,
          });
        }

        const res = await call(baseUrl, "POST", "/billing/invoices", {
          cookie: ownerCookie,
          // `taxRateBps: 0`: sin IVA de por medio, la comisión del 2 % se
          // puede comprobar con una división exacta en vez de arrastrar el
          // redondeo del impuesto — esta prueba no repite la cobertura de
          // IVA, que ya tiene su propia batería unitaria en `billing`.
          body: { direction: "school_to_student", studentId: student.studentId, lines, taxRateBps: 0, dueOn },
        });
        expect(res.status).toBe(201);
        expect(res.body.applicationFeeBps).toBe(200);
        const expectedFeeCents = Math.round(((res.body.totalCents as number) * 200) / 10_000);
        expect(res.body.applicationFeeCents).toBe(expectedFeeCents);

        invoices.push({ invoiceId: res.body.invoiceId as string, studentIndex: i, totalCents: res.body.totalCents as number });
      }

      /* ---- Paso 9: cobrar con Stripe en modo prueba ------------------------ */

      let specialPaymentId: string | null = null;
      for (const invoice of invoices) {
        const student = students[invoice.studentIndex]!;
        const res = await call(baseUrl, "POST", `/billing/invoices/${invoice.invoiceId}/payments`, {
          cookie: ownerCookie,
          body: { payerEmail: student.email, idempotencyKey: `pay-${invoice.invoiceId}` },
        });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("succeeded");
        expect(res.body.invoiceStatus).toBe("paid");
        if (invoice.studentIndex === specialStudentIndex) specialPaymentId = res.body.paymentId as string;
      }
      expect(specialPaymentId).toBeTruthy();

      const paidInvoices = await adminDb.execute<{ count: string }>(sql`
        SELECT count(*)::text AS count FROM invoices WHERE school_id = ${schoolId} AND status = 'paid'
      `);
      expect(Number(paidInvoices[0]?.count)).toBe(TOTAL_STUDENTS);

      /* ---- Paso 10: cancelar una clase y comprobar que se abre la devolución */

      const cancellation = await call(baseUrl, "POST", `/scheduling/sessions/${cancelCandidateSessionId}/cancel`, {
        cookie: ownerCookie,
        body: { party: "school", reason: "La escuela cancela la clase por baja médica del profesorado." },
      });
      expect(cancellation.status).toBe(200);
      expect(cancellation.body.refundDue).toBe(true);

      const refundRow = await waitUntil(
        async () => {
          const rows = await adminDb.execute<{
            amount_cents: number;
            status: string;
            application_fee_reversed_cents: number;
          }>(sql`
            SELECT r.amount_cents, r.status, r.application_fee_reversed_cents
            FROM refunds r
            WHERE r.school_id = ${schoolId} AND r.payment_id = ${specialPaymentId}
          `);
          return rows[0] ?? null;
        },
        { label: "la devolución automática abierta tras cancelar la clase" },
      );

      // Devuelve solo la línea de la clase cancelada (3000), no la factura
      // entera (8000 + 3000 = 11000): `findPaidChargeForSession` busca la
      // línea de ESTA sesión, no el total cobrado.
      expect(refundRow.amount_cents).toBe(SESSION_LINE_CENTS);
      expect(refundRow.status).toBe("succeeded");
      // Comisión del 2 % retenida en la devolución, proporcional a lo
      // devuelto: con IVA a 0 la cuenta es exacta, sin arrastre de redondeo.
      expect(refundRow.application_fee_reversed_cents).toBe(Math.round((SESSION_LINE_CENTS * 200) / 10_000));

      const refundCount = await adminDb.execute<{ count: string }>(sql`
        SELECT count(*)::text AS count FROM refunds WHERE school_id = ${schoolId}
      `);
      expect(Number(refundCount[0]?.count)).toBe(1);

      /* ---- Comisión congelada: cambiarla después no toca lo ya emitido ---- */
      // Regla vinculante de OLA-1.md: «cambiar después application_fee_bps de
      // la escuela no altera el histórico». Se comprueba de verdad, no solo
      // se asume: se sube la comisión y se confirma que una factura YA
      // emitida se queda con la de antes, mientras que una factura NUEVA sí
      // ve la comisión vigente.
      const firstInvoice = invoices[0]!;
      await adminDb.execute(sql`UPDATE schools SET application_fee_bps = 500 WHERE id = ${schoolId}`);

      const afterBpsChange = await call(baseUrl, "POST", "/billing/invoices", {
        cookie: ownerCookie,
        body: {
          direction: "school_to_student",
          studentId: students[6]!.studentId,
          lines: [{ description: "Cargo adicional tras subir la comisión", quantity: 1, unitCents: 1000 }],
          taxRateBps: 0,
          dueOn,
        },
      });
      expect(afterBpsChange.status).toBe(201);
      expect(afterBpsChange.body.applicationFeeBps).toBe(500);

      const frozenInvoice = await adminDb.execute<{ application_fee_bps: number }>(sql`
        SELECT application_fee_bps FROM invoices WHERE id = ${firstInvoice.invoiceId}
      `);
      expect(frozenInvoice[0]?.application_fee_bps).toBe(200);

      /* ---- Aserciones finales del guion ------------------------------------ */

      const listed = await call(baseUrl, "GET", "/students", { cookie: ownerCookie });
      expect(listed.status).toBe(200);
      const activeStudents = (listed.body as Json[]).filter((s) => s.status === "active");
      expect(activeStudents.length).toBe(TOTAL_STUDENTS);
      expect(activeStudents.filter((s) => s.guardianRequired === true).length).toBe(MINORS);

      /* ---- Paso 11 (hallazgo cerrado por esta tarea): RGPD bloqueado ------
       * durante impersonación.
       *
       * La Tarea 17 dejó anotado que `GET /people/:id/export` y
       * `POST /people/:id/erase` (Tarea 15) no estaban etiquetados como
       * acción restringida durante impersonación porque sus ficheros
       * estaban en vuelo en ese momento (`ESTADO.md`). Al leer
       * `personal-data.controller.ts` para escribir este recorrido, las dos
       * rutas YA llevan `@RestrictedWhileImpersonating("data_export_or_erasure")`
       * — el hueco se cerró en algún punto de la concurrencia entre esas dos
       * tareas, antes de que empezara esta. Lo que faltaba de verdad, y es
       * lo que añade esta prueba, es el caso de extremo a extremo que lo
       * demuestre: alguien de soporte impersonando a un usuario no puede
       * exportar ni borrar sus datos personales.
       *
       * Para que el chequeo de rol de `erase` (`@Roles("owner")`) tenga algo
       * que comprobar de verdad, soporte impersona al DUEÑO de la escuela —
       * la única combinación en la que la petición llega con el rol
       * correcto y es la propia restricción de impersonación, no un 403 por
       * rol insuficiente, quien la rechaza.
       */
      const ownerMembershipRow = await adminDb.execute<{ id: string }>(sql`
        SELECT id FROM memberships WHERE school_id = ${schoolId} AND role = 'owner' LIMIT 1
      `);
      const ownerMembershipId = ownerMembershipRow[0]?.id;
      if (!ownerMembershipId) throw new Error("No se encontró la membresía de la dueña.");

      // Control: fuera de cualquier impersonación, la propia dueña exporta
      // sus datos con normalidad — la restricción de más abajo es específica
      // de estar impersonando, no un bloqueo general de la ruta.
      const exportBefore = await call(baseUrl, "GET", `/people/${ownerMembershipId}/export`, {
        cookie: ownerCookie,
      });
      expect(exportBefore.status).toBe(200);
      expect(exportBefore.body.membershipId).toBe(ownerMembershipId);

      const supportEmail = `soporte@${EMAIL_DOMAIN}`;
      const supportPassword = "Soporte-e2e-2026!";
      await createPlatformSupportPersona(adminDb, {
        email: supportEmail,
        name: "Soporte E2E",
        password: supportPassword,
      });

      const supportSignIn = await call(baseUrl, "POST", "/auth/sign-in/email", {
        body: { email: supportEmail, password: supportPassword },
      });
      expect(supportSignIn.status).toBe(200);
      const supportCookie = supportSignIn.cookie;
      if (!supportCookie) throw new Error("El soporte de plataforma no pudo iniciar sesión.");

      const impersonation = await call(baseUrl, "POST", "/iam/impersonation", {
        cookie: supportCookie,
        body: {
          targetMembershipId: ownerMembershipId,
          reason: "Verificación e2e: soporte no debe poder exportar ni borrar datos personales.",
        },
      });
      expect(impersonation.status).toBe(201);

      const exportWhileImpersonating = await call(baseUrl, "GET", `/people/${ownerMembershipId}/export`, {
        cookie: supportCookie,
      });
      expect(exportWhileImpersonating.status).toBe(403);
      expect(exportWhileImpersonating.body.code).toBe("impersonation_forbidden_action");

      const eraseWhileImpersonating = await call(baseUrl, "POST", `/people/${ownerMembershipId}/erase`, {
        cookie: supportCookie,
      });
      expect(eraseWhileImpersonating.status).toBe(403);
      expect(eraseWhileImpersonating.body.code).toBe("impersonation_forbidden_action");

      const endImpersonation = await call(baseUrl, "DELETE", "/iam/impersonation", { cookie: supportCookie });
      expect(endImpersonation.status).toBe(200);

      /* ---- Limpieza: no dejar rastro en una base de datos compartida ------ */
      await adminDb.execute(sql`DELETE FROM schools WHERE id = ${schoolId}`);
      const emailPattern = `%@${EMAIL_DOMAIN}`;
      const staleAuthUsers = await adminDb
        .select({ id: schema.authUsers.id })
        .from(schema.authUsers)
        .where(like(schema.authUsers.email, emailPattern));
      const staleAuthUserIds = staleAuthUsers.map((row) => row.id);
      if (staleAuthUserIds.length > 0) {
        await adminDb.delete(schema.authAccounts).where(inArray(schema.authAccounts.userId, staleAuthUserIds));
        await adminDb.delete(schema.authUsers).where(inArray(schema.authUsers.id, staleAuthUserIds));
      }
      await adminDb.delete(schema.users).where(like(schema.users.email, emailPattern));
    },
  );
});
