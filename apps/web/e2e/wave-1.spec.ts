import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq, like, sql } from "drizzle-orm";
import IntlMessageFormat from "intl-messageformat";
import { createAdminDb, schema, type Db } from "@langopia/db";
import { expect, test } from "@playwright/test";
import { utcIsoToZonedInputValue, zonedTimeToUtcIso } from "../src/features/calendar/zoned-time.js";
import { languageDisplayName } from "../src/features/courses/format.js";
import { DICTIONARIES } from "../src/i18n/dictionaries.js";
import { formatDate, formatMoney } from "../src/i18n/format.js";
import type { Locale } from "../src/i18n/locale.js";

/**
 * Tarea 13 de la ola 1 (panel web): el criterio de «listo» del panel entero,
 * comprobado en un navegador real contra la API y el Postgres reales — nada
 * de mocks de infraestructura, mismo espíritu que la Tarea 10 del backend
 * (`apps/api/test/e2e/wave-1.e2e-spec.ts`), pero esta vez clicando, tecleando
 * y leyendo la pantalla como lo haría una persona que no ha visto el
 * producto: registra su escuela, da de alta un alumno menor con su tutor y
 * programa una clase, sin ayuda (brief, verbatim).
 *
 * ── Sustituciones deliberadas, cada una documentada donde ocurre ──────────
 *
 *   1. Verificación de correo: este entorno no envía correo de verdad —el
 *      enlace solo se registra en el log de la API
 *      (`sendVerificationEmail`, `better-auth.config.ts`)—, así que
 *      «comprobar el correo» se sustituye por marcar `emailVerified` en
 *      Postgres directamente (mismo patrón que
 *      `packages/db/src/seed/credentials.ts` y que
 *      `createBetterAuthCredential` en el e2e del backend) y, acto seguido,
 *      un inicio de sesión de verdad contra `POST /auth/sign-in/email` para
 *      obtener la cookie — el mismo endpoint que usaría la persona real, sin
 *      leer el enlace de un correo que aquí no existe.
 *   2. Comisión de plataforma: emitir una factura con comisión desglosada
 *      exige un comerciante de Stripe activo, y no hay forma de completar el
 *      alta real de Stripe Connect en una prueba automatizada. Se deja la
 *      escuela como lo dejaría un alta de comerciante completada —igual que
 *      hace el seed (`atlantico.ts`) y el propio e2e del backend—, con una
 *      escritura directa en `schools`.
 *   3. Un alumno recién matriculado NO tiene credencial de Better Auth por
 *      diseño (`EnrolStudentHandler` solo crea `users`/`memberships`, nunca
 *      `authUsers`/`authAccounts` — ver el informe de esta tarea). Para
 *      poder «entrar como el alumno» (paso 13, verbatim) se le da una
 *      credencial exactamente como lo hace `seedCredentials`.
 *
 * Todo lo demás —cada clic, cada formulario, cada aviso que se lee en
 * pantalla— es la aplicación real.
 *
 * Dos hallazgos del montaje se arreglaron en el propio código del panel
 * (pequeños y claros, regla 7 de CONTEXTO.md — ver el informe de esta
 * tarea): `HireTeacherDialog.tsx` (no había forma de dar de alta a un
 * profesor desde el panel) y el picker de grupo/profesor de
 * `CalendarScreen.tsx` (no listaba un grupo o profesor sin clases previas,
 * así que no se podía programar la primera clase de un grupo nuevo).
 */

/* ────────────────────────────── Utilidades de traducción ─────────────────
 * Nada de literales de traducción sueltos en las aserciones: `t(locale, ...)`
 * lee el MISMO diccionario y aplica el MISMO formateador ICU que `useT()`
 * (`src/i18n/translate.tsx`) — si el texto cambia algún día, esta prueba lo
 * sigue sin que nadie tenga que ir a buscar la cadena nueva a mano.
 */
function readPath(node: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (acc !== null && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, node);
}

function t(locale: Locale, key: string, params?: Record<string, unknown>): string {
  const pattern = readPath(DICTIONARIES[locale], key);
  if (typeof pattern !== "string") {
    throw new Error(`[wave-1.spec] Falta la clave de traducción «${key}» (${locale}).`);
  }
  return new IntlMessageFormat(pattern, locale).format(params ?? {}) as string;
}

/**
 * La parte fija de un patrón ICU, antes de su primer marcador (p. ej.
 * `errors.insufficient_role` = "Esta acción requiere el rol {required}." →
 * "Esta acción requiere el rol"). Sirve para comprobar que apareció el
 * mensaje traducido correcto sin conocer el valor exacto de `{required}`
 * (los roles que exige cada ruta) ni arriesgarse a que `t()` lance por
 * faltarle un parámetro que esta prueba no tiene motivo para calcular ella
 * misma — sigue sin haber ni un literal de traducción suelto en la prueba.
 */
function staticPrefix(locale: Locale, key: string): string {
  const pattern = readPath(DICTIONARIES[locale], key);
  if (typeof pattern !== "string") {
    throw new Error(`[wave-1.spec] Falta la clave de traducción «${key}» (${locale}).`);
  }
  const marker = pattern.indexOf("{");
  return (marker === -1 ? pattern : pattern.slice(0, marker)).trim();
}

/* ────────────────────────────── Utilidades de fecha/hora ─────────────────
 * El reloj de la API es el REAL — a diferencia de la Tarea 10 del backend,
 * que sí sustituye el reloj de la aplicación entera por uno controlable—:
 * no hay forma de correr el proceso de la API dentro del propio proceso de
 * Playwright con un doble de infraestructura sin dejar de ser una prueba de
 * verdad contra el servidor de verdad. Estas utilidades calculan siempre a
 * partir de "ahora", nunca de una fecha fija, para que la prueba siga
 * funcionando mañana.
 */
function dateOnlyUtc(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

function yearsAgoUtc(years: number): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return dateOnlyUtc(d);
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/** Fecha local (YYYY-MM-DD) en Europe/Madrid de un instante — para fijar una hora de pared cómoda dentro de la disponibilidad declarada del profesorado (Paso 3), sin importar la hora real a la que corra esta prueba. */
function madridDatePart(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/* ────────────────────────────── Identidad de esta ejecución ──────────────
 * Correos y slug únicos por ejecución (igual que la Tarea 10 del backend):
 * esta prueba corre igual contra un Postgres recién desplegado que contra el
 * de desarrollo ya sembrado, y nunca choca con una ejecución anterior de sí
 * misma. `users.email` es único GLOBALMENTE (`users_email_uq`,
 * `packages/db/src/schema/tenancy.ts`), no solo dentro de una escuela.
 */
const RUN = randomUUID().slice(0, 8);
const EMAIL_DOMAIN = `e2e-web-${RUN}.langopia.test`;
const SCHOOL_SLUG = `e2e-web-${RUN}`;
const SCHOOL_NAME = `Academia Recorrido ${RUN}`;

const OWNER_EMAIL = `duena@${EMAIL_DOMAIN}`;
const OWNER_PASSWORD = "Recorrido-e2e-2026!";
const OWNER_NAME = "Marina Duarte";

const STUDENT_ADULT_EMAIL = `alumno-adulto@${EMAIL_DOMAIN}`;
const STUDENT_ADULT_NAME = "Adulto E2E";
const STUDENT_ADULT_PASSWORD = "Alumno-e2e-2026!";

const STUDENT_MINOR_EMAIL = `alumno-menor@${EMAIL_DOMAIN}`;
const STUDENT_MINOR_NAME = "Menor E2E";
const GUARDIAN_EMAIL = `tutor@${EMAIL_DOMAIN}`;
const GUARDIAN_NAME = "Tutor E2E";

const TEACHER_EMAIL = `profesora@${EMAIL_DOMAIN}`;
const TEACHER_NAME = "Profesora E2E";

const COURSE_CODE = `ING-B1-${RUN}`;
const COURSE_NAME_ES = "Inglés B1 grupo";
const GROUP_NAME = `Grupo E2E ${RUN}`;

/* ────────────────────────────── Credenciales sin bandeja de entrada ──────
 * Mismo patrón que `packages/db/src/seed/credentials.ts` y que
 * `createBetterAuthCredential` (`apps/api/test/e2e/wave-1.e2e-spec.ts`): es
 * la única vía que este propio repositorio demuestra para obtener una sesión
 * de Better Auth verificada sin bandeja de entrada real.
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
 * Un alumno recién matriculado (`POST /students`) no tiene credencial: solo
 * `users`/`memberships` (ver sustitución 3, cabecera). Esta función le da
 * una, atándola con `users.auth_user_id` — el mismo puente que usa
 * `seedCredentials`.
 */
async function giveStudentALogin(
  db: Db,
  params: { email: string; name: string; password: string },
): Promise<void> {
  const authUserId = await createBetterAuthCredential(db, params);
  await db.update(schema.users).set({ authUserId }).where(eq(schema.users.email, params.email));
}

/* ────────────────────────────── La prueba ────────────────────────────────── */

test.describe("Ola 1 — recorrido completo del panel (Tarea 13)", () => {
  // Registro, puesta en marcha, alta de profesorado y alumnado, importación,
  // tres clases con dos cancelaciones y una lista de asistencia (con espera
  // real a que la tercera empiece), facturación y portal: más margen que el
  // timeout por defecto de Playwright (30 s). En local dura unos 5 min; el
  // runner de CI (2 vCPU) superó los 10 min, así que 20.
  test.setTimeout(20 * 60 * 1000);

  let adminDb: Db;
  let closeAdminDb: () => Promise<void>;

  test.beforeAll(() => {
    const admin = createAdminDb();
    adminDb = admin.db;
    closeAdminDb = () => admin.client.end({ timeout: 5 });
  });

  test.afterAll(async () => {
    await closeAdminDb?.();
  });

  test("una persona que no ha visto el producto registra su escuela, da de alta un alumno menor con su tutor y programa una clase, sin ayuda", async ({
    page,
    browser,
  }) => {
    let schoolId = "";
    let invoiceId = "";
    let invoiceNumber = "";
    let invoiceTotalCents = 0;
    let invoiceApplicationFeeCents = 0;
    let invoiceDueOnIso: string | null = null;
    let groupId = "";

    try {
      /* ---- Paso 1: registrar una escuela nueva desde /registro --------- */
      await test.step("Paso 1: registrar una escuela nueva desde /registro", async () => {
        await page.goto("/registro");

        await page.getByLabel(t("es-ES", "onboarding.signUp.nameLabel")).fill(OWNER_NAME);
        await page.getByLabel(t("es-ES", "onboarding.signUp.emailLabel")).fill(OWNER_EMAIL);
        await page.getByLabel(t("es-ES", "onboarding.signUp.passwordLabel")).fill(OWNER_PASSWORD);
        await page.getByRole("button", { name: t("es-ES", "onboarding.signUp.submit"), exact: true }).click();

        // Fase 2: cuenta creada, correo sin verificar.
        await expect(page.getByRole("heading", { name: t("es-ES", "onboarding.verify.title") })).toBeVisible();

        // Sustitución 1 (ver cabecera): sin bandeja de entrada real, se marca
        // el correo como verificado directamente en Postgres...
        await adminDb.update(schema.authUsers).set({ emailVerified: true }).where(eq(schema.authUsers.email, OWNER_EMAIL));
        // ...y se inicia sesión de verdad contra el endpoint real de Better
        // Auth, en el MISMO contexto de navegador que `page` (`page.request`
        // comparte cookies con `page`): es exactamente lo que haría el
        // enlace del correo real (`autoSignInAfterVerification`), sin tener
        // uno.
        const signIn = await page.request.post("/api/v1/auth/sign-in/email", {
          data: { email: OWNER_EMAIL, password: OWNER_PASSWORD },
        });
        expect(signIn.ok(), await signIn.text()).toBeTruthy();

        // La propia pantalla, ahora sí: pulsar "ya he confirmado mi correo".
        await page.getByRole("button", { name: t("es-ES", "onboarding.verify.confirmButton") }).click();

        // Fase 3: correo verificado, sin escuela — el formulario de alta.
        await expect(page.getByRole("heading", { name: t("es-ES", "onboarding.register.title") })).toBeVisible();
        await page.getByLabel(t("es-ES", "onboarding.register.nameLabel")).fill(SCHOOL_NAME);
        await page.getByLabel(t("es-ES", "onboarding.register.slugLabel")).fill(SCHOOL_SLUG);

        const [registerResponse] = await Promise.all([
          page.waitForResponse((r) => r.url().includes("/schools/register") && r.request().method() === "POST"),
          page.getByRole("button", { name: t("es-ES", "onboarding.register.submit"), exact: true }).click(),
        ]);
        expect(registerResponse.ok(), await registerResponse.text()).toBeTruthy();
        const registered = (await registerResponse.json()) as { schoolId: string; slug: string };
        schoolId = registered.schoolId;
        expect(schoolId).toBeTruthy();

        await expect(page).toHaveURL(/\/bienvenida$/);
      });

      /* ---- Paso 2: completar la puesta en marcha ------------------------ */
      // Nota sobre los localizadores: "Guardar" es el mismo texto en los
      // pasos "Marca" e "Idioma" (`onboarding.brandStep.save` ===
      // `onboarding.languageStep.save`), así que cada acción se escoge
      // dentro del `<form>` que contiene su propio campo distintivo —no del
      // `<Card>` que lo envuelve— para no ambigüar entre los dos.
      await test.step("Paso 2: completar la puesta en marcha", async () => {
        await expect(page.getByRole("heading", { name: t("es-ES", "onboarding.welcome.title") })).toBeVisible();

        // Marca: se rellena de verdad (no se salta), para probar el paso.
        await page.getByLabel(t("es-ES", "onboarding.brandStep.nameLabel")).fill(`${SCHOOL_NAME} S.L.`);
        const brandForm = page.locator("form").filter({ has: page.getByLabel(t("es-ES", "onboarding.brandStep.nameLabel")) });
        await brandForm.getByRole("button", { name: t("es-ES", "onboarding.brandStep.save"), exact: true }).click();
        await expect(page.getByText(t("es-ES", "onboarding.brandStep.success"))).toBeVisible();

        // Idiomas: se guarda con el valor por defecto (es-ES) — prueba el
        // paso sin cambiar el idioma del resto del recorrido.
        const languageForm = page.locator("form").filter({ has: page.getByLabel(t("es-ES", "onboarding.languageStep.label")) });
        await languageForm.getByRole("button", { name: t("es-ES", "onboarding.languageStep.save"), exact: true }).click();
        await expect(page.getByText(t("es-ES", "onboarding.languageStep.success"))).toBeVisible();

        // Primer profesor (invitación por correo): se salta — el alta de
        // profesorado de verdad, con tarifa y disponibilidad, es el Paso 3
        // de este mismo recorrido, en /profesores.
        const teacherForm = page.locator("form").filter({ has: page.getByLabel(t("es-ES", "onboarding.teacherStep.emailLabel")) });
        await teacherForm.getByRole("button", { name: t("es-ES", "onboarding.teacherStep.skip"), exact: true }).click();
        await expect(page.getByLabel(t("es-ES", "onboarding.teacherStep.emailLabel"))).toHaveCount(0);

        // Primer curso: se completa de verdad (el Paso 4 de este recorrido
        // solo añade el GRUPO sobre este curso). Único botón "Crear curso"
        // en la pantalla en este momento: sin ambigüedad de texto.
        await page.getByRole("button", { name: t("es-ES", "onboarding.courseStep.create"), exact: true }).click();

        const courseDialog = page.getByRole("dialog", { name: t("es-ES", "courses.create.title") });
        await courseDialog.getByLabel(t("es-ES", "courses.create.codeLabel")).fill(COURSE_CODE);
        await courseDialog.getByLabel(t("es-ES", "courses.create.languageLabel")).fill("en");
        await courseDialog.getByLabel(t("es-ES", "courses.create.levelLabel")).selectOption("B1");
        await courseDialog.getByLabel(t("es-ES", "courses.create.modalityLabel")).selectOption("group");
        await courseDialog.getByLabel(t("es-ES", "courses.create.priceLabel")).fill("80");
        const spanishLabel = languageDisplayName("es-ES", "es-ES");
        await courseDialog
          .getByLabel(t("es-ES", "courses.create.translationNameLabel", { language: spanishLabel }))
          .fill(COURSE_NAME_ES);
        await courseDialog.getByRole("button", { name: t("es-ES", "courses.create.submit"), exact: true }).click();
        await expect(page.getByText(t("es-ES", "courses.create.success"))).toBeVisible();

        await page.getByRole("button", { name: t("es-ES", "onboarding.welcome.goToDashboard"), exact: true }).click();
        await expect(page).toHaveURL(/\/$/);
      });

      /* ---- Paso 3: profesor con disponibilidad -------------------------- */
      // Nota (hallazgo de esta tarea, ver el informe): `/profesores` no
      // tiene enlace en la navegación de dirección todavía (`nav-links.ts`
      // solo ofrece "/", "/alumnos" y "/calendario"). Se navega directamente
      // a la ruta, que sí existe y funciona.
      let teacherId = "";
      await test.step("Paso 3: dar de alta un profesor con disponibilidad", async () => {
        await page.goto("/profesores");
        await page.getByRole("button", { name: t("es-ES", "teachers.newTeacher"), exact: true }).first().click();

        const hireDialog = page.getByRole("dialog", { name: t("es-ES", "teachers.create.title") });
        await hireDialog.getByLabel(t("es-ES", "teachers.create.nameLabel")).fill(TEACHER_NAME);
        await hireDialog.getByLabel(t("es-ES", "teachers.create.emailLabel")).fill(TEACHER_EMAIL);
        await hireDialog.getByLabel(t("es-ES", "teachers.create.tierLabel")).selectOption("professional");
        await hireDialog.getByLabel(t("es-ES", "teachers.create.hourlyRateLabel")).fill("2500");
        await hireDialog.getByLabel(t("es-ES", "teachers.create.contractedHoursLabel")).fill("20");
        await hireDialog.getByLabel(t("es-ES", "teachers.create.hiredAtLabel")).fill(yearsAgoUtc(1));

        const [hireResponse] = await Promise.all([
          page.waitForResponse((r) => r.url().endsWith("/teachers") && r.request().method() === "POST"),
          hireDialog.getByRole("button", { name: t("es-ES", "teachers.create.submit"), exact: true }).click(),
        ]);
        expect(hireResponse.ok(), await hireResponse.text()).toBeTruthy();
        teacherId = ((await hireResponse.json()) as { teacherId: string }).teacherId;
        expect(teacherId).toBeTruthy();
        await expect(page.getByText(t("es-ES", "teachers.create.success"))).toBeVisible();

        await page.getByRole("link", { name: TEACHER_NAME }).click();
        await expect(page).toHaveURL(new RegExp(`/profesores/${teacherId}$`));
        await page.getByRole("tab", { name: t("es-ES", "teachers.detail.tabAvailability") }).click();

        const availabilityTable = page.getByRole("table", { name: t("es-ES", "teachers.availability.caption") });
        // Columnas 09:00-11:00 (índices 3..5: la cuadrícula empieza en las
        // 06:00) en los siete días, para que cualquier hora de pared entre
        // las 9 y las 12 en Europe/Madrid, cualquier día de la semana, caiga
        // dentro (ver el Paso 8, que programa una clase a las 10:00).
        const HOUR_COLUMNS = [3, 4, 5];
        for (let weekdayRow = 0; weekdayRow < 7; weekdayRow++) {
          const row = availabilityTable.locator("tbody tr").nth(weekdayRow);
          for (const column of HOUR_COLUMNS) {
            const cell = row.locator("button").nth(column);
            if (weekdayRow === 0 && column === HOUR_COLUMNS[0]) {
              // Criterio de «listo»: el panel se usa entero con teclado. Esta
              // celda, en concreto, se activa con el teclado —foco más
              // Espacio—, nunca con `.click()`, para demostrar que el botón
              // nativo de la cuadrícula (Tarea 8) es de verdad operable así.
              await cell.focus();
              await page.keyboard.press("Space");
            } else {
              await cell.click();
            }
            await expect(cell).toHaveAttribute("aria-pressed", "true");
          }
        }

        await page.getByRole("button", { name: t("es-ES", "teachers.availability.save"), exact: true }).click();
        await expect(page.getByText(t("es-ES", "teachers.availability.success"))).toBeVisible();
      });

      /* ---- Paso 4: crear un grupo del curso ------------------------------ */
      // (El curso ya se creó en el Paso 2, dentro de la puesta en marcha.)
      // Nota (hallazgo de esta tarea): `/cursos` tampoco tiene enlace de
      // navegación todavía — se navega directamente a la ruta.
      await test.step("Paso 4: crear un grupo del curso", async () => {
        await page.goto("/cursos");
        const courseCard = page.locator("section, div").filter({ hasText: COURSE_CODE }).first();
        await courseCard.getByRole("button", { name: t("es-ES", "courses.newGroup"), exact: true }).click();

        const groupDialog = page.getByRole("dialog", { name: t("es-ES", "courses.groupCreate.title", { course: COURSE_NAME_ES }) });
        await groupDialog.getByLabel(t("es-ES", "courses.groupCreate.nameLabel")).fill(GROUP_NAME);
        await groupDialog.getByLabel(t("es-ES", "courses.groupCreate.teacherLabel")).selectOption({ label: TEACHER_NAME });
        await groupDialog.getByLabel(t("es-ES", "courses.groupCreate.startsOnLabel")).fill(dateOnlyUtc(new Date()));

        const [groupResponse] = await Promise.all([
          page.waitForResponse((r) => r.url().endsWith("/groups") && r.request().method() === "POST"),
          groupDialog.getByRole("button", { name: t("es-ES", "courses.groupCreate.submit"), exact: true }).click(),
        ]);
        expect(groupResponse.ok(), await groupResponse.text()).toBeTruthy();
        groupId = ((await groupResponse.json()) as { groupId: string }).groupId;
        expect(groupId).toBeTruthy();

        await expect(page.getByText(t("es-ES", "courses.groupCreate.success"))).toBeVisible();
        await page.getByRole("link", { name: GROUP_NAME }).click();
        await expect(page).toHaveURL(new RegExp(`/grupos/${groupId}$`));
      });

      /* ---- Paso 5: dar de alta un alumno adulto -------------------------- */
      await test.step("Paso 5: dar de alta un alumno adulto", async () => {
        await page.getByRole("link", { name: t("es-ES", "nav.students") }).click();
        await expect(page).toHaveURL(/\/alumnos$/);
        await page.getByRole("button", { name: t("es-ES", "students.newStudent"), exact: true }).first().click();
        await expect(page).toHaveURL(/\/alumnos\/nuevo$/);

        await page.getByLabel(t("es-ES", "students.create.nameLabel")).fill(STUDENT_ADULT_NAME);
        await page.getByLabel(t("es-ES", "students.create.emailLabel")).fill(STUDENT_ADULT_EMAIL);
        await page.getByLabel(t("es-ES", "students.create.dateOfBirthLabel")).fill(yearsAgoUtc(28));
        await page.getByLabel(t("es-ES", "students.create.nativeLanguageLabel")).fill("es");
        await page.getByLabel(t("es-ES", "students.create.targetLanguageLabel")).fill("en");

        // La sección de tutor legal NO debe aparecer para un adulto.
        await expect(page.getByRole("group", { name: t("es-ES", "students.create.guardianTitle") })).toHaveCount(0);

        const [enrolResponse] = await Promise.all([
          page.waitForResponse((r) => r.url().endsWith("/students") && r.request().method() === "POST"),
          page.getByRole("button", { name: t("es-ES", "students.create.submit"), exact: true }).click(),
        ]);
        expect(enrolResponse.ok(), await enrolResponse.text()).toBeTruthy();
        const enrolled = (await enrolResponse.json()) as { studentId: string; guardianRequired: boolean };
        expect(enrolled.guardianRequired).toBe(false);

        await expect(page).toHaveURL(new RegExp(`/alumnos/${enrolled.studentId}$`));
        await expect(page.getByRole("heading", { name: STUDENT_ADULT_NAME })).toBeVisible();

        // Se matricula en el grupo del Paso 4 — hace falta un alumno en el
        // padrón para poder pasar lista en el Paso 11, y para comprobar en
        // el Paso 13 que ve sus propias clases y facturas, no las de nadie
        // más.
        await page.goto(`/grupos/${groupId}`);
        await page.getByLabel(t("es-ES", "courses.groupDetail.studentLabel")).selectOption({ label: STUDENT_ADULT_NAME });
        await page.getByRole("button", { name: t("es-ES", "courses.groupDetail.enrolSubmit"), exact: true }).click();
        await expect(page.getByText(t("es-ES", "courses.groupDetail.enrolSuccess"))).toBeVisible();
      });

      /* ---- Paso 6: alumno menor → el formulario exige tutor -------------- */
      await test.step("Paso 6: dar de alta un alumno menor y comprobar que el formulario exige tutor", async () => {
        await page.goto("/alumnos/nuevo");

        await page.getByLabel(t("es-ES", "students.create.nameLabel")).fill(STUDENT_MINOR_NAME);
        await page.getByLabel(t("es-ES", "students.create.emailLabel")).fill(STUDENT_MINOR_EMAIL);
        await page.getByLabel(t("es-ES", "students.create.nativeLanguageLabel")).fill("es");
        await page.getByLabel(t("es-ES", "students.create.targetLanguageLabel")).fill("en");

        // Antes de escribir la fecha de nacimiento, la sección de tutor no
        // existe todavía.
        await expect(page.getByRole("group", { name: t("es-ES", "students.create.guardianTitle") })).toHaveCount(0);

        // Al escribir una fecha de menor, la sección aparece SOLA — la regla
        // de negocio hecha interfaz, verbatim del brief.
        await page.getByLabel(t("es-ES", "students.create.dateOfBirthLabel")).fill(yearsAgoUtc(10));
        await expect(page.getByRole("group", { name: t("es-ES", "students.create.guardianTitle") })).toBeVisible();

        // Sin rellenar el tutor, el envío no pasa: el formulario lo impide
        // antes de intentarlo, sin llegar a la API.
        await page.getByRole("button", { name: t("es-ES", "students.create.submit"), exact: true }).click();
        await expect(page.getByText(t("es-ES", "students.create.guardianNameRequired"))).toBeVisible();
        await expect(page).toHaveURL(/\/alumnos\/nuevo$/);

        await page.getByLabel(t("es-ES", "students.create.guardianNameLabel")).fill(GUARDIAN_NAME);
        await page.getByLabel(t("es-ES", "students.create.guardianEmailLabel")).fill(GUARDIAN_EMAIL);
        await page.getByLabel(t("es-ES", "students.create.guardianRelationshipLabel")).selectOption("mother");

        const [enrolResponse] = await Promise.all([
          page.waitForResponse((r) => r.url().endsWith("/students") && r.request().method() === "POST"),
          page.getByRole("button", { name: t("es-ES", "students.create.submit"), exact: true }).click(),
        ]);
        expect(enrolResponse.ok(), await enrolResponse.text()).toBeTruthy();
        const enrolled = (await enrolResponse.json()) as { studentId: string; guardianRequired: boolean };
        expect(enrolled.guardianRequired).toBe(true);
        await expect(page).toHaveURL(new RegExp(`/alumnos/${enrolled.studentId}$`));
      });

      /* ---- Paso 7: importar 20 alumnos desde CSV, 2 filas erróneas ------- */
      await test.step("Paso 7: importar 20 alumnos desde CSV, con 2 filas erróneas señaladas", async () => {
        const TOTAL = 20;
        const INVALID = 2;
        const header =
          "nombre,email,fecha_nacimiento,idioma_nativo,idioma_objetivo,nivel,tutor_nombre,tutor_email,tutor_parentesco";
        const rows = [header];
        for (let i = 0; i < TOTAL; i++) {
          const name = `Alumno CSV ${i}`;
          const email = `csv-alumno-${i}-${RUN}@${EMAIL_DOMAIN}`;
          const dob = yearsAgoUtc(30); // siempre adulto, no hace falta tutor en el CSV.
          if (i === 5) {
            rows.push(`${name},correo-invalido-sin-arroba,${dob},es,en,,,,`); // fila inválida: correo mal formado.
          } else if (i === 12) {
            rows.push(`${name},${email},31-01-1990,es,en,,,,`); // fila inválida: fecha con formato incorrecto.
          } else {
            rows.push(`${name},${email},${dob},es,en,B1,,,`);
          }
        }
        const csv = rows.join("\n");

        await page.goto("/alumnos");
        await page.getByRole("button", { name: t("es-ES", "students.importCsv"), exact: true }).click();
        await expect(page).toHaveURL(/\/alumnos\/importar$/);

        await page
          .getByLabel(t("es-ES", "students.import.fileLabel"))
          .setInputFiles({ name: "alumnos.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf-8") });
        await page.getByRole("button", { name: t("es-ES", "students.import.analyze"), exact: true }).click();

        await expect(
          page.getByText(t("es-ES", "students.import.summary", { total: TOTAL, valid: TOTAL - INVALID, invalid: INVALID })),
        ).toBeVisible();
        // `exact: true`: el resumen de arriba ("20 filas: 18 válidas, 2 con
        // errores.") también contiene la subcadena "con errores" — sin
        // coincidencia exacta, `getByText` la cuenta como una tercera fila.
        expect(await page.getByText(t("es-ES", "students.import.rowInvalid"), { exact: true }).count()).toBe(INVALID);

        await page.getByRole("button", { name: t("es-ES", "students.import.confirm"), exact: true }).click();
        // El mismo texto aparece dos veces al confirmar: en el aviso (toast)
        // y en la etiqueta permanente del paso "hecho" — se escoge el toast,
        // sin ambigüedad, por la región accesible que ya declara `Toast.tsx`.
        const toastRegion = page.getByRole("region", { name: t("es-ES", "common.toastRegionLabel") });
        await expect(
          toastRegion.getByText(t("es-ES", "students.import.commitSummary", { created: TOTAL - INVALID, updated: 0 })),
        ).toBeVisible();
      });

      /* ---- Paso 8: programar tres clases en el calendario ---------------- *
       * Sesión A: >24h — con el profesor del Paso 3 asignado, a una hora fija
       * (10:00 Madrid) dentro de su disponibilidad (09:00-12:00, Paso 3), dos
       * días vista: siempre a más de 24h de aviso, sin importar la hora real
       * a la que corra esta prueba.
       * Sesión B: <24h — sin profesor asignado (evita depender de que la hora
       * exacta caiga dentro de una disponibilidad concreta).
       * Sesión C: la que recibirá lista de asistencia (Paso 11) — sin
       * profesor asignado, a unos minutos vista: se espera de verdad (reloj
       * REAL de la API, sin sustituto como en el e2e del backend) a que
       * empiece.
       */
      const sessionAStart = `${madridDatePart(daysFromNow(2))}T10:00`;
      const sessionBTarget = hoursFromNow(3);
      const sessionCTarget = minutesFromNow(4);

      async function scheduleSession(params: {
        startsAtLocalValue: string;
        teacherName?: string;
        roomUrlSuffix: string;
      }): Promise<void> {
        // `.first()`: antes de la primera clase, el calendario vacío también
        // ofrece "Programar clase" como acción del propio `EmptyState`.
        await page.getByRole("button", { name: t("es-ES", "calendar.newSession"), exact: true }).first().click();
        const dialog = page.getByRole("dialog", { name: t("es-ES", "calendar.scheduleDialogTitle") });
        await dialog.getByLabel(t("es-ES", "calendar.groupLabel")).selectOption({ label: `${COURSE_CODE} — ${GROUP_NAME}` });
        if (params.teacherName) {
          await dialog.getByLabel(t("es-ES", "calendar.teacherLabel")).selectOption({ label: params.teacherName });
        }
        await dialog.getByLabel(t("es-ES", "calendar.startsAtLabel")).fill(params.startsAtLocalValue);
        await dialog.getByLabel(t("es-ES", "calendar.durationLabel")).fill("30");
        await dialog.getByLabel(t("es-ES", "calendar.roomProviderLabel")).selectOption("livekit");
        await dialog.getByLabel(t("es-ES", "calendar.roomUrlLabel")).fill(`https://video.langopia.test/${params.roomUrlSuffix}`);

        const [sessionResponse] = await Promise.all([
          page.waitForResponse((r) => r.url().endsWith("/scheduling/sessions") && r.request().method() === "POST"),
          dialog.getByRole("button", { name: t("es-ES", "calendar.scheduleSubmit"), exact: true }).click(),
        ]);
        expect(sessionResponse.ok(), await sessionResponse.text()).toBeTruthy();
        await expect(page.getByText(t("es-ES", "calendar.scheduleSuccessToast"))).toBeVisible();
      }

      await test.step("Paso 8: programar tres clases en el calendario", async () => {
        await page.getByRole("link", { name: t("es-ES", "nav.calendar") }).click();
        await expect(page).toHaveURL(/\/calendario$/);

        await scheduleSession({ startsAtLocalValue: sessionAStart, teacherName: TEACHER_NAME, roomUrlSuffix: `${RUN}-a` });
        await scheduleSession({
          startsAtLocalValue: utcIsoToZonedInputValue(sessionBTarget.toISOString(), "Europe/Madrid"),
          roomUrlSuffix: `${RUN}-b`,
        });
        await scheduleSession({
          startsAtLocalValue: utcIsoToZonedInputValue(sessionCTarget.toISOString(), "Europe/Madrid"),
          roomUrlSuffix: `${RUN}-c`,
        });
      });

      /**
       * Abre el menú de una clase por su franja horaria: las tres comparten
       * `GROUP_NAME`, así que localizar por nombre de grupo no basta.
       * `WeekGrid` pinta cada clase como un botón con
       * `aria-label="{grupo} · {rango horario} · ..."`. Navega a la semana
       * siguiente si la clase no está en la semana visible — a lo sumo una
       * vez, porque ninguna de las tres queda a más de dos días vista.
       */
      async function openSessionMenu(startsAt: Date): Promise<void> {
        const timeLabel = new Intl.DateTimeFormat("es-ES", {
          timeZone: "Europe/Madrid",
          hour: "2-digit",
          minute: "2-digit",
        }).format(startsAt);
        const sessionButton = page.getByRole("button", { name: new RegExp(timeLabel.replace(":", "\\:")) });
        if ((await sessionButton.count()) === 0) {
          await page.getByRole("button", { name: t("es-ES", "calendar.nextWeek"), exact: true }).click();
        }
        await page.getByRole("button", { name: new RegExp(timeLabel.replace(":", "\\:")) }).first().click();
      }

      async function cancelSessionExpectingRefund(startsAt: Date, refundExpected: boolean): Promise<void> {
        await openSessionMenu(startsAt);
        await page.getByRole("button", { name: t("es-ES", "calendar.actionCancel"), exact: true }).click();

        const dialog = page.getByRole("dialog", { name: t("es-ES", "calendar.cancelDialogTitle") });
        // El PARTY importa: una cancelación "school" siempre da derecho a
        // devolución en la API (`CancellationPolicy.refundDueFor`), sin mirar
        // el aviso — "student" es la que compara horas de aviso contra el
        // umbral. Para comprobar de verdad la diferencia >24h/<24h hay que
        // cancelar como "student" en los dos casos.
        await dialog.getByLabel(t("es-ES", "calendar.partyLabel")).selectOption("student");
        await dialog.getByLabel(t("es-ES", "calendar.reasonLabel")).fill("Cancelación de prueba del recorrido de la ola 1.");

        const previewText = refundExpected ? t("es-ES", "calendar.refundPreviewYes") : t("es-ES", "calendar.refundPreviewNo");
        await expect(dialog.getByText(previewText)).toBeVisible();

        const [cancelResponse] = await Promise.all([
          page.waitForResponse((r) => r.url().includes("/cancel") && r.request().method() === "POST"),
          dialog.getByRole("button", { name: t("es-ES", "calendar.confirmCancel"), exact: true }).click(),
        ]);
        expect(cancelResponse.ok(), await cancelResponse.text()).toBeTruthy();
        const cancelled = (await cancelResponse.json()) as { refundDue: boolean };
        expect(cancelled.refundDue).toBe(refundExpected);

        const toastText = refundExpected
          ? t("es-ES", "calendar.cancelSuccessToastRefund")
          : t("es-ES", "calendar.cancelSuccessToastNoRefund");
        await expect(page.getByText(toastText)).toBeVisible();
      }

      /* ---- Paso 9: cancelar una con más de 24h → anuncia devolución ------ */
      await test.step("Paso 9: cancelar la sesión con más de 24h de aviso → la interfaz anuncia devolución", async () => {
        // `sessionAStart` es hora de pared de Madrid ("YYYY-MM-DDT10:00") y la
        // app la guarda y la pinta así; `new Date(cadena)` la interpretaría
        // en la zona del proceso (UTC en el runner de CI) y el menú se
        // buscaría a una hora que el calendario no muestra — el clic esperaría
        // para siempre. El instante correcto sale del mismo conversor que usa
        // la app (`zonedTimeToUtcIso`), igual que las sesiones B y C.
        await cancelSessionExpectingRefund(
          new Date(zonedTimeToUtcIso(sessionAStart, "Europe/Madrid")),
          true,
        );
      });

      /* ---- Paso 10: cancelar otra con menos de 24h → sin devolución ------ */
      await test.step("Paso 10: cancelar la sesión con menos de 24h de aviso → la interfaz anuncia que no hay devolución", async () => {
        await cancelSessionExpectingRefund(sessionBTarget, false);
      });

      /* ---- Paso 11: pasar lista de la tercera ---------------------------- */
      await test.step("Paso 11: pasar lista de la tercera clase", async () => {
        // Reloj real, sin sustituto (a diferencia del e2e del backend, que sí
        // controla el reloj de la aplicación entera): se espera de verdad a
        // que la clase empiece — `record-attendance` exige `startsAt <= now`.
        const remainingMs = sessionCTarget.getTime() - Date.now();
        if (remainingMs > 0) await page.waitForTimeout(remainingMs + 2_000);

        await openSessionMenu(sessionCTarget);
        await page.getByRole("button", { name: t("es-ES", "calendar.actionAttendance"), exact: true }).click();

        const dialog = page.getByRole("dialog", { name: t("es-ES", "calendar.attendanceDialogTitle") });
        await expect(dialog.getByText(STUDENT_ADULT_NAME)).toBeVisible();

        const [attendanceResponse] = await Promise.all([
          page.waitForResponse((r) => r.url().includes("/attendance") && r.request().method() === "POST"),
          dialog.getByRole("button", { name: t("es-ES", "calendar.confirmAttendance"), exact: true }).click(),
        ]);
        expect(attendanceResponse.ok(), await attendanceResponse.text()).toBeTruthy();
        await expect(page.getByText(t("es-ES", "calendar.attendanceSuccessToast"))).toBeVisible();
      });

      /* ---- Paso 12: emitir una factura y ver la comisión desglosada ------ */
      await test.step("Paso 12: emitir una factura y ver la comisión desglosada", async () => {
        // Sustitución 2 (ver cabecera): comerciante de Stripe activo, con
        // comisión del 2 %, escrito directamente — no hay alta real de
        // Stripe Connect posible en una prueba automatizada.
        await adminDb.execute(sql`
          UPDATE schools
          SET merchant_status = 'active',
              merchant_ref = ${`acct_e2e_web_${RUN}`},
              application_fee_enabled = true,
              application_fee_bps = 200
          WHERE id = ${schoolId}
        `);

        // Sin enlace de navegación todavía (mismo hallazgo que /profesores y
        // /cursos): se navega directamente a la ruta.
        await page.goto("/facturacion");
        await page.getByRole("button", { name: t("es-ES", "billing.newInvoice"), exact: true }).first().click();

        const dialog = page.getByRole("dialog", { name: t("es-ES", "billing.issue.title") });
        await dialog.getByLabel(t("es-ES", "billing.issue.studentLabel")).selectOption({ label: STUDENT_ADULT_NAME });
        // "Facturar a" se autoselecciona en cuanto se conoce el destinatario
        // (un adulto sin tutores es su propio destinatario) — se espera a
        // que deje de estar vacío antes de continuar.
        await expect(dialog.getByLabel(t("es-ES", "billing.issue.billToLabel"))).not.toHaveValue("");
        await dialog.getByLabel(t("es-ES", "billing.issue.lineDescriptionLabel")).fill("Mensualidad de idiomas");
        await dialog.getByLabel(t("es-ES", "billing.issue.lineQuantityLabel")).fill("1");
        await dialog.getByLabel(t("es-ES", "billing.issue.lineUnitAmountLabel")).fill("80");
        await dialog.getByLabel(t("es-ES", "billing.issue.dueOnLabel")).fill(dateOnlyUtc(daysFromNow(15)));

        const [issueResponse] = await Promise.all([
          page.waitForResponse((r) => r.url().endsWith("/billing/invoices") && r.request().method() === "POST"),
          dialog.getByRole("button", { name: t("es-ES", "billing.issue.submit"), exact: true }).click(),
        ]);
        expect(issueResponse.ok(), await issueResponse.text()).toBeTruthy();
        const issued = (await issueResponse.json()) as {
          invoiceId: string;
          number: string;
          totalCents: number;
          applicationFeeBps: number;
          applicationFeeCents: number;
        };
        invoiceId = issued.invoiceId;
        invoiceNumber = issued.number;
        invoiceTotalCents = issued.totalCents;
        invoiceApplicationFeeCents = issued.applicationFeeCents;
        expect(issued.applicationFeeBps).toBe(200);
        expect(issued.applicationFeeCents).toBe(Math.round((issued.totalCents * 200) / 10_000));

        await page.getByRole("link", { name: invoiceNumber }).click();
        await expect(page).toHaveURL(new RegExp(`/facturacion/${invoiceId}$`));

        // La comisión desglosada: la escuela tiene derecho a ver qué se le
        // retiene, y el importe/porcentaje los calcula la API, no este
        // formulario ni esta prueba.
        await expect(page.getByText(formatMoney(invoiceApplicationFeeCents, "EUR", "es-ES"))).toBeVisible();
        await expect(page.getByText("2%")).toBeVisible();

        // Fecha de vencimiento real, para la comprobación de idioma más
        // abajo — se lee de la propia API, no de lo que se tecleó, para no
        // arrastrar ninguna transformación propia de esta prueba.
        const detail = await page.request.get(`/api/v1/billing/invoices/${invoiceId}`);
        invoiceDueOnIso = ((await detail.json()) as { dueOn: string | null }).dueOn;
      });

      /* ---- Paso 13: entrar como el alumno y ver solo sus datos ----------- */
      await test.step("Paso 13: entrar como el alumno y ver solo sus datos", async () => {
        // Sustitución 3 (ver cabecera): un alumno recién matriculado no
        // tiene credencial de Better Auth hasta que algo se la da.
        await giveStudentALogin(adminDb, {
          email: STUDENT_ADULT_EMAIL,
          name: STUDENT_ADULT_NAME,
          password: STUDENT_ADULT_PASSWORD,
        });

        // Contexto de navegador NUEVO (persona distinta, sesión distinta) —
        // nunca reutilizar la cookie de la dueña.
        const studentContext = await browser.newContext({ locale: "es-ES", timezoneId: "Europe/Madrid" });
        const studentPage = await studentContext.newPage();
        try {
          await studentPage.goto("/entrar");

          // Criterio de «listo»: el panel se usa entero con teclado. Este
          // acceso se hace sin un solo clic de ratón: enfocar el correo,
          // teclear, Tab hasta la contraseña, teclear, Intro para enviar.
          await studentPage.getByLabel(t("es-ES", "auth.emailLabel")).focus();
          await studentPage.keyboard.type(STUDENT_ADULT_EMAIL);
          await studentPage.keyboard.press("Tab");
          await expect(studentPage.getByLabel(t("es-ES", "auth.passwordLabel"))).toBeFocused();
          await studentPage.keyboard.type(STUDENT_ADULT_PASSWORD);
          await studentPage.keyboard.press("Enter");

          // Aterriza en "/" (Tarea 3): el panel no redirige todavía según el
          // rol de la sesión (hallazgo de esta tarea, ver el informe) — el
          // alumno ve un error de permisos insuficientes en el panel de
          // dirección, NUNCA un «algo salió mal» genérico ni el código
          // crudo, y desde ahí sí puede navegar a su propio portal.
          // `.first()`: el panel de dirección pinta VARIOS widgets
          // independientes (indicadores, alumnado en riesgo, ocupación de
          // profesorado...), cada uno con su propia consulta — con una
          // sesión de alumno, más de uno de ellos falla con
          // `insufficient_role` a la vez, cada uno con su propio rol exigido
          // (`owner, admin` uno, `owner, admin, teacher` otro), así que basta
          // con comprobar que AL MENOS uno anuncia el error traducido, no
          // uno concreto ni los tres.
          await expect(studentPage).toHaveURL(/\/$/);
          await expect(
            studentPage.getByText(staticPrefix("es-ES", "errors.insufficient_role")).first(),
          ).toBeVisible();

          await studentPage.getByRole("link", { name: t("es-ES", "nav.mySessions") }).click();
          await expect(studentPage).toHaveURL(/\/mi\/clases$/);
          // `.first()`: el alumno está matriculado en un único grupo, pero
          // ese grupo tiene TRES clases (Paso 8) — tres filas, cada una con
          // el mismo nombre de grupo. Basta con comprobar que el portal
          // pinta sus propias clases, no una fila concreta.
          await expect(studentPage.getByText(GROUP_NAME).first()).toBeVisible();

          await studentPage.getByRole("link", { name: t("es-ES", "nav.myInvoices") }).click();
          await expect(studentPage).toHaveURL(/\/mi\/facturas$/);
          await expect(studentPage.getByText(invoiceNumber)).toBeVisible();
          const invoiceRows = studentPage.getByRole("row").filter({ hasText: invoiceNumber });
          await expect(invoiceRows).toHaveCount(1);

          // Ninguna pantalla de dirección se cuela: intentar /alumnos
          // muestra el mismo error de permisos traducido, no una pantalla
          // rota ni un literal en blanco.
          await studentPage.goto("/alumnos");
          await expect(studentPage.getByText(staticPrefix("es-ES", "errors.insufficient_role"))).toBeVisible();
        } finally {
          await studentContext.close();
        }
      });

      /* ---- Criterio de «listo»: ninguna pantalla muestra español a quien
       * pidió gallego ----------------------------------------------------- */
      await test.step("Criterio: ninguna pantalla muestra español a quien pidió gallego", async () => {
        // Aviso del brief: el Chrome de este entorno no trae datos ICU para
        // gl-ES (el formateo de importes/fechas cae a un patrón genérico
        // SOLO en este navegador; en Node es correcto — Tarea 5). Por eso
        // esta comprobación se queda en TEXTO del diccionario, nunca en
        // `Intl.NumberFormat`/`Intl.DateTimeFormat` para gl-ES: fijar en la
        // prueba un fallo del entorno, no del panel.
        const glContext = await browser.newContext({ locale: "gl-ES" });
        const glPage = await glContext.newPage();
        try {
          await glPage.goto("/entrar");
          const passwordLabelGl = t("gl-ES", "auth.passwordLabel");
          const passwordLabelEs = t("es-ES", "auth.passwordLabel");
          // Comprobación de que la clave de verdad difiere entre los dos
          // idiomas — si algún día dejara de diferir, esta prueba avisaría
          // de que ya no demuestra nada.
          expect(passwordLabelGl).not.toBe(passwordLabelEs);
          await expect(glPage.getByLabel(passwordLabelGl)).toBeVisible();
        } finally {
          await glContext.close();
        }
      });

      /* ---- Criterio de «listo»: cambiar el idioma cambia importes y fechas */
      await test.step("Criterio: cambiar el idioma cambia toda la interfaz, importes y fechas incluidos", async () => {
        const enContext = await browser.newContext({ locale: "en-GB", timezoneId: "Europe/Madrid" });
        const enPage = await enContext.newPage();
        try {
          await enPage.goto("/entrar");
          await enPage.getByLabel(t("en-GB", "auth.emailLabel")).fill(OWNER_EMAIL);
          await enPage.getByLabel(t("en-GB", "auth.passwordLabel")).fill(OWNER_PASSWORD);
          await enPage.getByRole("button", { name: t("en-GB", "auth.submit"), exact: true }).click();
          await expect(enPage).toHaveURL(/\/$/);

          await enPage.goto(`/facturacion/${invoiceId}`);

          const totalEnGB = formatMoney(invoiceTotalCents, "EUR", "en-GB");
          const totalEsES = formatMoney(invoiceTotalCents, "EUR", "es-ES");
          expect(totalEnGB).not.toBe(totalEsES);
          // `.first()`: con una única línea, su importe coincide con el total
          // de la factura — el mismo valor formateado aparece dos veces en
          // la pantalla (el resumen y la propia línea), sin ambigüedad de
          // negocio ninguna, solo de cuál de las dos lee esta prueba.
          await expect(enPage.getByText(totalEnGB).first()).toBeVisible();

          if (invoiceDueOnIso) {
            const dueEnGB = formatDate(invoiceDueOnIso, "UTC", "en-GB", { dateStyle: "medium" });
            const dueEsES = formatDate(invoiceDueOnIso, "UTC", "es-ES", { dateStyle: "medium" });
            expect(dueEnGB).not.toBe(dueEsES);
            await expect(enPage.getByText(dueEnGB).first()).toBeVisible();
          }
        } finally {
          await enContext.close();
        }
      });
    } finally {
      /* ---- Limpieza: no dejar rastro en una base de datos compartida ---- */
      if (schoolId) {
        await adminDb.execute(sql`DELETE FROM schools WHERE id = ${schoolId}`).catch(() => undefined);
      }
      const emailPattern = `%@${EMAIL_DOMAIN}`;
      const staleAuthUsers = await adminDb
        .select({ id: schema.authUsers.id })
        .from(schema.authUsers)
        .where(like(schema.authUsers.email, emailPattern));
      const staleAuthUserIds = staleAuthUsers.map((row) => row.id);
      if (staleAuthUserIds.length > 0) {
        for (const id of staleAuthUserIds) {
          await adminDb.delete(schema.authAccounts).where(eq(schema.authAccounts.userId, id));
        }
        for (const id of staleAuthUserIds) {
          await adminDb.delete(schema.authUsers).where(eq(schema.authUsers.id, id));
        }
      }
      await adminDb.delete(schema.users).where(like(schema.users.email, emailPattern));
    }
  });
});
