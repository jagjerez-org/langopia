import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { BadRequestException, type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { hashPassword } from "better-auth/crypto";
import { inArray, like, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminDb, schema, type Db } from "@langopia/db";
import { AppModule } from "../../src/app.module.js";
import {
  MAILER,
  type EmailTemplate,
  type MailerPort,
} from "../../src/contexts/notifications/domain/ports/mailer.port.js";

/**
 * Tarea 12, paso 8 de la ola 1: «cancelar una clase y comprobar que sale un
 * correo por alumno, cada uno en su idioma» — automatizado.
 *
 * Recorre el camino completo con peticiones HTTP reales contra el `AppModule`
 * y Postgres real (RLS incluida): alta de escuela, alumnos con idiomas
 * distintos (dos adultos y un menor con tutor), grupo, clase y cancelación.
 * Lo único sustituido es `MAILER`, por un doble que ANOTA cada envío en vez
 * de llamar a Resend: es justo lo que esta prueba quiere observar (a quién se
 * escribe, en qué idioma y con qué plantilla), y el adaptador real
 * (`ResendMailerAdapter`) ya tiene su propia batería unitaria para la
 * entrega. Sin `RESEND_API_KEY`, además, el adaptador real solo registraría
 * en el log — no habría nada observable desde aquí.
 *
 * La escuela y las personas se crean con correos únicos por ejecución y se
 * borran al final, igual que `wave-1.e2e-spec.ts`: la prueba corre igual
 * contra un Postgres vacío que contra el de desarrollo ya sembrado, y no
 * cancela ninguna clase DEL SEED (cancelar es una mutación; dejar el seed
 * tocado rompería cualquier verificación posterior que dependa de él).
 */

interface SentEmail {
  to: string;
  locale: string;
  template: EmailTemplate;
  data: Record<string, unknown>;
}

/** Ver la cabecera: nunca habla con Resend; solo deja constancia del envío. */
class RecordingMailer implements MailerPort {
  readonly sent: SentEmail[] = [];

  async send(params: SentEmail): Promise<void> {
    this.sent.push(params);
  }
}

type Json = Record<string, any>;

interface ApiResult {
  status: number;
  body: Json;
  cookie: string | null;
}

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

/**
 * Credencial de Better Auth ya verificada, sin pasar por el correo real —
 * mismo patrón que `wave-1.e2e-spec.ts` y `packages/db/src/seed/credentials.ts`.
 */
async function createBetterAuthCredential(
  db: Db,
  params: { email: string; name: string; password: string },
): Promise<void> {
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
}

/**
 * `OnClassSessionCanceledEmail` reacciona al evento DESPUÉS de que la
 * petición de cancelación ya haya respondido (`EventBus.publish` no espera),
 * así que los correos no tienen por qué estar anotados todavía al devolver
 * el 200. Se sondea en vez de asumir instantáneo — igual que hace `wave-1`
 * con la devolución de billing.
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

function dateYearsAgo(years: number, from: Date): string {
  const d = new Date(from);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

const RUN = randomUUID().slice(0, 8);
const EMAIL_DOMAIN = `e2e-mail-${RUN}.langopia.test`;

describe("Tarea 12 — notificaciones por correo al cancelar una clase (paso 8)", () => {
  let app: INestApplication;
  let baseUrl: string;
  let adminDb: Db;
  let closeAdminDb: () => Promise<void>;
  const mailer = new RecordingMailer();

  const startedAt = new Date();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MAILER)
      .useValue(mailer)
      .compile();

    app = moduleRef.createNestApplication();

    // Mismo `ValidationPipe` que `main.ts` (ver `wave-1.e2e-spec.ts`).
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

    // Puerto 0: el sistema operativo asigna uno libre.
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

  it("cancelar una clase avisa a cada alumno del grupo, en el idioma del destinatario", async () => {
    /* ---- Escuela y dueña ------------------------------------------------- */

    const ownerEmail = `duena@${EMAIL_DOMAIN}`;
    const ownerPassword = "Recorrido-e2e-mail-2026!";
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
      body: { slug: `e2e-mail-${RUN}`, name: "Academia E2E Correo" },
    });
    expect(registered.status).toBe(201);
    const schoolId = registered.body.schoolId as string;

    /* ---- Tres alumnos con idiomas distintos -------------------------------
     *
     * Es lo que el paso 8 quiere demostrar: «cada uno en su idioma». Dos
     * adultos (de-DE y en-GB) y un menor (pt-BR) con tutor. El idioma del
     * correo del menor no es el suyo: es el del tutor que lo recibe.
     */

    const adultoDe = await call(baseUrl, "POST", "/students", {
      cookie: ownerCookie,
      body: {
        name: "Alumno Alemán",
        email: `adulto-de@${EMAIL_DOMAIN}`,
        dateOfBirth: dateYearsAgo(30, startedAt),
        nativeLanguage: "de",
        targetLanguage: "es",
        locale: "de-DE",
      },
    });
    expect(adultoDe.status).toBe(201);

    const adultoEn = await call(baseUrl, "POST", "/students", {
      cookie: ownerCookie,
      body: {
        name: "Alumno Inglés",
        email: `adulto-en@${EMAIL_DOMAIN}`,
        dateOfBirth: dateYearsAgo(28, startedAt),
        nativeLanguage: "en",
        targetLanguage: "es",
        locale: "en-GB",
      },
    });
    expect(adultoEn.status).toBe(201);

    const guardianEmail = `tutor-gl@${EMAIL_DOMAIN}`;
    const menor = await call(baseUrl, "POST", "/students", {
      cookie: ownerCookie,
      body: {
        name: "Alumna Menor",
        email: `menor-pt@${EMAIL_DOMAIN}`,
        dateOfBirth: dateYearsAgo(10, startedAt),
        nativeLanguage: "pt",
        targetLanguage: "es",
        locale: "pt-BR",
        guardian: {
          name: "Tutor Galego",
          email: guardianEmail,
          relationship: "father",
        },
      },
    });
    expect(menor.status).toBe(201);
    expect(menor.body.guardianRequired).toBe(true);

    // El tutor se aprovisionó heredando el idioma de la matrícula (pt-BR).
    // Se fija el suyo propio (gl-ES) directamente en su membresía — no hay
    // endpoint para cambiarlo todavía, y es justo lo que el paso 2 del brief
    // decidió: «el idioma sale del DESTINATARIO, no de la escuela ni del
    // alumno». Si el correo del menor llegara en pt-BR, la regla estaría rota.
    await adminDb.execute(sql`
      UPDATE memberships m
      SET locale = 'gl-ES'
      FROM users u
      WHERE u.id = m.user_id
        AND u.email = ${guardianEmail}
        AND m.school_id = ${schoolId}
    `);

    const studentIds = [
      adultoDe.body.studentId as string,
      adultoEn.body.studentId as string,
      menor.body.studentId as string,
    ];

    /* ---- Profesora, curso, grupo y matrículas ---------------------------- */

    const hire = await call(baseUrl, "POST", "/teachers", {
      cookie: ownerCookie,
      body: {
        name: "Profesora E2E",
        email: `profesora@${EMAIL_DOMAIN}`,
        tier: "professional",
        hourlyRateCents: 2500,
        contractedHoursPerWeek: 20,
        hiredAt: dateYearsAgo(2, startedAt),
        locale: "es-ES",
      },
    });
    expect(hire.status).toBe(201);
    const teacherId = hire.body.teacherId as string;

    const course = await call(baseUrl, "POST", "/courses", {
      cookie: ownerCookie,
      body: {
        code: `ESP-A2-${RUN}`,
        language: "es",
        level: "A2",
        modality: "group",
        maxStudents: 10,
        priceCents: 6000,
        currency: "EUR",
        translations: [{ locale: "es-ES", name: "Español A2 grupo" }],
      },
    });
    expect(course.status).toBe(201);

    const group = await call(baseUrl, "POST", "/groups", {
      cookie: ownerCookie,
      body: {
        courseId: course.body.courseId,
        teacherId,
        name: "Español A2 — grupo 1",
        startsOn: startedAt.toISOString().slice(0, 10),
      },
    });
    expect(group.status).toBe(201);
    const groupId = group.body.groupId as string;

    for (const studentId of studentIds) {
      const enrolment = await call(baseUrl, "POST", `/groups/${groupId}/enrolments`, {
        cookie: ownerCookie,
        body: { studentId },
      });
      expect(enrolment.status).toBe(201);
    }

    /* ---- Una clase mañana, cancelada por la escuela ----------------------- */

    const startsAt = new Date(startedAt.getTime() + 24 * 60 * 60 * 1000);
    const session = await call(baseUrl, "POST", "/scheduling/sessions", {
      cookie: ownerCookie,
      body: {
        groupId,
        teacherId,
        startsAt: startsAt.toISOString(),
        durationMinutes: 60,
        roomProvider: "livekit",
        roomUrl: "https://video.langopia.test/e2e-mail",
        overrideAvailability: true,
      },
    });
    expect(session.status).toBe(201);
    const sessionId = session.body.sessionId as string;

    // Las matrículas de arriba ya dispararon sus correos de bienvenida
    // (`student_welcome`): la prueba mira solo los de cancelación.
    const cancellation = await call(baseUrl, "POST", `/scheduling/sessions/${sessionId}/cancel`, {
      cookie: ownerCookie,
      body: { party: "school", reason: "Baja médica del profesorado." },
    });
    expect(cancellation.status).toBe(200);

    const cancellationEmails = await waitUntil(
      async () => {
        const found = mailer.sent.filter((mail) => mail.template === "class_canceled");
        return found.length === studentIds.length ? found : null;
      },
      { label: "los tres correos de clase cancelada" },
    );

    /* ---- La comprobación del paso 8: uno por alumno, cada uno en su idioma */

    const byRecipient = new Map(cancellationEmails.map((mail) => [mail.to, mail]));

    // Adulto alemán: le escriben a él, en de-DE.
    const paraAdultoDe = byRecipient.get(`adulto-de@${EMAIL_DOMAIN}`);
    expect(paraAdultoDe?.locale).toBe("de-DE");
    expect(paraAdultoDe?.data["name"]).toBe("Alumno Alemán");

    // Adulto inglés: le escriben a él, en en-GB.
    const paraAdultoEn = byRecipient.get(`adulto-en@${EMAIL_DOMAIN}`);
    expect(paraAdultoEn?.locale).toBe("en-GB");
    expect(paraAdultoEn?.data["name"]).toBe("Alumno Inglés");

    // Menor: NADIE escribe a su correo; el aviso va al tutor, y en el idioma
    // DEL TUTOR (gl-ES), no en el del alumno (pt-BR).
    expect(byRecipient.has(`menor-pt@${EMAIL_DOMAIN}`)).toBe(false);
    const paraTutor = byRecipient.get(guardianEmail);
    expect(paraTutor?.locale).toBe("gl-ES");
    expect(paraTutor?.data["name"]).toBe("Tutor Galego");

    // Los tres llevan el motivo y la fecha de la clase cancelada.
    for (const mail of cancellationEmails) {
      expect(mail.data["reason"]).toBe("Baja médica del profesorado.");
      expect(mail.data["startsAt"]).toBe(startsAt.toISOString());
    }

    /* ---- Limpieza: no dejar rastro en una base de datos compartida ------- */
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
  });
});
