/**
 * Seed de Langopia.
 *
 *   npm run db:seed
 *
 * Crea tres escuelas con perfiles deliberadamente distintos para que cada
 * pantalla del producto tenga datos con los que probarse:
 *
 *   atlantico  es-ES  plan Crecimiento  Connect activo   comisión 2 %
 *   nordwind   de-DE  plan Inicial      sin Connect      comisión 0 %, en prueba
 *   paulista   pt-BR  plan Escala       Connect activo   comisión 0 % pactada
 *
 * Al terminar comprueba el aislamiento entre escuelas con el rol de
 * aplicación. Si esa comprobación falla, el seed sale con error: una fuga
 * entre tenants no es un aviso, es un fallo de construcción.
 */
import { sql } from "drizzle-orm";
import pino from "pino";
import postgres from "postgres";
import { createAdminDb, type Db } from "../index.js";
import * as s from "../schema/index.js";
import { SEED_PASSWORD, seedCredentials, verifyCredentials } from "./credentials.js";
import { NOW } from "./helpers.js";
import { seedPlans } from "./reference.js";
import { seedAtlantico } from "./scenarios/atlantico.js";
import { seedNordwind } from "./scenarios/nordwind.js";
import { seedSaoPaulo } from "./scenarios/saopaulo.js";

/**
 * Mismo formato que el de la API (Tarea 8c): JSON en producción, legible en
 * desarrollo. Un despliegue que falla al sembrar o al aplicar políticas debe
 * leerse igual que un fallo en caliente — el mismo `level`/`msg`/`context`,
 * no un `console.error` suelto que un agregador no sabe indexar.
 *
 * Se usa para el avance del seed y para todo aviso o fallo real; el informe
 * final (tablas de escuelas, totales, casos borde) sigue en `console.log`
 * tal cual: es una tabla para que la lea un humano en la terminal, no un
 * evento que buscar en un agregador.
 */
const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : {
          target: "pino-pretty",
          options: { translateTime: "HH:MM:ss.l", ignore: "pid,hostname" },
        },
  serializers: { err: pino.stdSerializers.err },
}).child({ context: "seed" });

/** Orden inverso al de dependencias, para que los TRUNCATE no fallen. */
const TABLES_TO_CLEAR = [
  // Las tablas de Better Auth entran aquí desde que el seed crea credenciales:
  // si no se limpiaran, la segunda ejecución chocaría con el índice único de
  // `user.email`. Efecto secundario que conviene saber: `db:seed` borra también
  // las cuentas registradas a mano por la API.
  "session",
  "account",
  "verification",
  "user",
  "mcp_authorizations",
  "site_blocks",
  "site_pages",
  "sites",
  "leads",
  "placement_items",
  // Impersonación de soporte (Tarea 17): referencian `memberships`/`users`,
  // así que van ANTES de esas dos, igual que `audit_logs`.
  "impersonations",
  "platform_support_staff",
  "audit_logs",
  "ai_generations",
  "mcp_clients",
  "transcript_segments",
  "transcripts",
  "credit_ledger",
  "refunds",
  "payments",
  "invoice_lines",
  "invoices",
  "subscriptions",
  "reviews",
  "survey_responses",
  "surveys",
  "evaluations",
  "attempts",
  "assessments",
  "srs_cards",
  "exercise_translations",
  "exercises",
  "rubrics",
  "content_assets",
  "content_unit_translations",
  "content_units",
  "attendance",
  "sessions",
  "session_recurrences",
  "enrollments",
  "groups",
  "course_translations",
  "courses",
  "teacher_availability",
  "teacher_profiles",
  "consents",
  "guardians",
  "student_profiles",
  "invitations",
  "memberships",
  "school_domains",
  "schools",
  "plans",
  "users",
];

/**
 * Persona de soporte de la plataforma (Tarea 17), deliberadamente SIN
 * membresía en ninguna escuela: es el caso que de verdad prueba que
 * `impersonator_membership_id` puede quedar en blanco y aun así impersonar a
 * cualquiera. `seedCredentials` la recoge igual que a cualquier otro `users`
 * y le crea su credencial de Better Auth.
 */
async function seedPlatformSupport(db: Db): Promise<void> {
  const [support] = await db
    .insert(s.users)
    .values({
      email: "soporte@langopia.app",
      emailVerifiedAt: NOW,
      name: "Soporte Langopia",
      locale: "es-ES",
      timezone: "Europe/Madrid",
      authProvider: "password",
      lastSeenAt: NOW,
    })
    .returning();
  await db.insert(s.platformSupportStaff).values({ userId: support!.id });
}

async function main() {
  const started = Date.now();
  const { db, client } = createAdminDb();

  try {
    logger.info("Limpiando tablas…");
    await db.execute(
      sql.raw(`TRUNCATE TABLE ${TABLES_TO_CLEAR.map((t) => `public."${t}"`).join(", ")} CASCADE`),
    );

    logger.info("Planes…");
    const plans = await seedPlans(db);
    const planIds = new Map([...plans].map(([code, plan]) => [code, plan.id]));

    logger.info("Escuela Atlántico (es-ES)…");
    const atlantico = await seedAtlantico(db, planIds);

    logger.info("Sprachschule Nordwind (de-DE)…");
    await seedNordwind(db, planIds);

    logger.info("Idiomas Paulista (pt-BR)…");
    await seedSaoPaulo(db, planIds, atlantico.danUserId);

    logger.info("Soporte de la plataforma (Tarea 17)…");
    await seedPlatformSupport(db);

    logger.info("Credenciales de Better Auth…");
    const credentials = await seedCredentials(db);
    await verifyCredentials(db);
    logger.info(`${credentials} credenciales verificadas. Contraseña de todas: ${SEED_PASSWORD}`);

    await printSummary(client);
    await verifyTenantIsolation(client, atlantico.school.id);

    logger.info(`Listo en ${((Date.now() - started) / 1000).toFixed(1)} s.`);
  } finally {
    await client.end();
  }
}

/* ─── Resumen ──────────────────────────────────────────────────────────── */

async function printSummary(client: postgres.Sql) {
  const rows = await client<
    Array<{
      name: string;
      slug: string;
      locale: string;
      status: string;
      connect: string;
      fee: string;
      students: string;
      teachers: string;
      sessions: string;
      invoices: string;
    }>
  >`
    SELECT
      sc.name,
      sc.slug,
      sc.default_locale                                             AS locale,
      sc.status,
      sc.merchant_status                                            AS connect,
      CASE WHEN sc.application_fee_enabled
           THEN round(sc.application_fee_bps / 100.0, 2)::float8::text || ' %'
           ELSE 'desactivada' END                                   AS fee,
      (SELECT count(*) FROM student_profiles p WHERE p.school_id = sc.id)::text AS students,
      (SELECT count(*) FROM teacher_profiles p WHERE p.school_id = sc.id)::text AS teachers,
      (SELECT count(*) FROM sessions x       WHERE x.school_id = sc.id)::text AS sessions,
      (SELECT count(*) FROM invoices i       WHERE i.school_id = sc.id)::text AS invoices
    FROM schools sc
    ORDER BY sc.slug
  `;

  console.log("\n─── Escuelas ───────────────────────────────────────────────");
  for (const r of rows) {
    console.log(
      `  ${r.name}\n` +
        `    ${r.slug} · ${r.locale} · ${r.status} · Connect: ${r.connect} · comisión: ${r.fee}\n` +
        `    ${r.students} alumnos · ${r.teachers} profesores · ${r.sessions} clases · ${r.invoices} facturas`,
    );
  }

  const totals = await client<Array<{ label: string; n: string }>>`
    SELECT 'usuarios'          AS label, count(*)::text AS n FROM users
    UNION ALL SELECT 'membresías',        count(*)::text FROM memberships
    UNION ALL SELECT 'tutores legales',   count(*)::text FROM guardians
    UNION ALL SELECT 'consentimientos',   count(*)::text FROM consents
    UNION ALL SELECT 'clases',            count(*)::text FROM sessions
    UNION ALL SELECT 'asistencias',       count(*)::text FROM attendance
    UNION ALL SELECT 'unidades',          count(*)::text FROM content_units
    UNION ALL SELECT 'ejercicios',        count(*)::text FROM exercises
    UNION ALL SELECT 'intentos',          count(*)::text FROM attempts
    UNION ALL SELECT 'exámenes',          count(*)::text FROM assessments
    UNION ALL SELECT 'facturas',          count(*)::text FROM invoices
    UNION ALL SELECT 'cobros',            count(*)::text FROM payments
    UNION ALL SELECT 'devoluciones',      count(*)::text FROM refunds
    UNION ALL SELECT 'transcripciones',   count(*)::text FROM transcripts
    UNION ALL SELECT 'clientes MCP',      count(*)::text FROM mcp_clients
    UNION ALL SELECT 'auditoría',         count(*)::text FROM audit_logs
    UNION ALL SELECT 'tarjetas de repaso', count(*)::text FROM srs_cards
    UNION ALL SELECT 'candidatos',         count(*)::text FROM leads
    UNION ALL SELECT 'páginas web',        count(*)::text FROM site_pages
    UNION ALL SELECT 'bloques web',        count(*)::text FROM site_blocks
    UNION ALL SELECT 'banco nivelación',   count(*)::text FROM placement_items
    UNION ALL SELECT 'tokens MCP',         count(*)::text FROM mcp_authorizations
  `;

  console.log("\n─── Totales ────────────────────────────────────────────────");
  for (const t of totals) console.log(`  ${t.label.padEnd(18)} ${t.n.padStart(6)}`);

  /* Casos borde que el seed promete cubrir. Si alguno sale a cero, la demo
     tiene un agujero y hay que saberlo aquí, no delante de un cliente. */
  const cases = await client<Array<{ label: string; n: string }>>`
    SELECT 'alumnos menores'                AS label, count(*)::text AS n FROM student_profiles WHERE guardian_required
    UNION ALL SELECT 'alumnos de baja',        count(*)::text FROM student_profiles WHERE status = 'left'
    UNION ALL SELECT 'alumnos pausados',       count(*)::text FROM student_profiles WHERE status = 'paused'
    UNION ALL SELECT 'profesores que se fueron', count(*)::text FROM teacher_profiles WHERE status = 'left'
    UNION ALL SELECT 'consentimientos denegados', count(*)::text FROM consents WHERE status = 'denied'
    UNION ALL SELECT 'consentimientos retirados', count(*)::text FROM consents WHERE status = 'withdrawn'
    UNION ALL SELECT 'clases canceladas',      count(*)::text FROM sessions WHERE status IN ('canceled_by_school','canceled_by_student')
    UNION ALL SELECT 'clases replanificadas',  count(*)::text FROM sessions WHERE status = 'rescheduled'
    UNION ALL SELECT 'clases sin asistentes',  count(*)::text FROM sessions WHERE status = 'no_show'
    UNION ALL SELECT 'unidades en revisión',   count(*)::text FROM content_units WHERE status = 'in_review'
    UNION ALL SELECT 'recursos en beta',       count(*)::text FROM content_assets WHERE is_beta
    UNION ALL SELECT 'correcciones sin firmar', count(*)::text FROM attempts WHERE status = 'ai_graded'
    UNION ALL SELECT 'facturas vencidas',      count(*)::text FROM invoices WHERE status = 'past_due'
    UNION ALL SELECT 'cobros fallidos',        count(*)::text FROM payments WHERE status = 'failed'
    UNION ALL SELECT 'con comisión aplicada',  count(*)::text FROM invoices WHERE application_fee_cents > 0
    UNION ALL SELECT 'transcripción bloqueada', count(*)::text FROM transcripts WHERE status = 'blocked_no_consent'
    UNION ALL SELECT 'generaciones fallidas',  count(*)::text FROM ai_generations WHERE status = 'failed'
    UNION ALL SELECT 'acciones vía MCP',       count(*)::text FROM audit_logs WHERE actor_kind = 'mcp'
    UNION ALL SELECT 'repasos vencidos',        count(*)::text FROM srs_cards WHERE due_on <= current_date
    UNION ALL SELECT 'candidatos convertidos',  count(*)::text FROM leads WHERE status = 'converted'
    UNION ALL SELECT 'candidatos fríos',        count(*)::text FROM leads WHERE status = 'cold'
    UNION ALL SELECT 'sitios publicados',       count(*)::text FROM sites WHERE status = 'published'
    UNION ALL SELECT 'tokens MCP revocados',    count(*)::text FROM mcp_authorizations WHERE revoked_at IS NOT NULL
    UNION ALL SELECT 'tokens MCP caducados',    count(*)::text FROM mcp_authorizations WHERE expires_at < now() AND revoked_at IS NULL
  `;

  console.log("\n─── Casos borde ────────────────────────────────────────────");
  let missing = 0;
  for (const c of cases) {
    const empty = c.n === "0";
    if (empty) missing++;
    console.log(`  ${empty ? "VACÍO" : "  ok "}  ${c.label.padEnd(26)} ${c.n.padStart(4)}`);
  }
  if (missing > 0) {
    logger.warn(`${missing} caso(s) sin datos: la demo no puede enseñarlos.`);
  }

  /* Los once tipos de ejercicio. */
  const exerciseTypes = await client<Array<{ type: string; n: string }>>`
    SELECT type::text, count(*)::text AS n FROM exercises GROUP BY type ORDER BY type
  `;
  console.log("\n─── Tipos de ejercicio con datos ───────────────────────────");
  console.log(`  ${exerciseTypes.map((t) => `${t.type} (${t.n})`).join(", ")}`);

  /* Persona presente en más de una escuela: el caso que prueba el aislamiento. */
  const shared = await client<Array<{ name: string; schools: string }>>`
    SELECT u.name, string_agg(sc.slug, ', ' ORDER BY sc.slug) AS schools
    FROM users u
    JOIN memberships m ON m.user_id = u.id
    JOIN schools sc ON sc.id = m.school_id
    GROUP BY u.id, u.name
    HAVING count(DISTINCT m.school_id) > 1
  `;
  if (shared.length > 0) {
    console.log("\n─── Personas en varias escuelas ────────────────────────────");
    for (const p of shared) console.log(`  ${p.name} → ${p.schools}`);
  }
}

/* ─── Comprobación de aislamiento ──────────────────────────────────────── */

/**
 * Se conecta con el rol de aplicación, fija el contexto de UNA escuela y
 * comprueba que no ve nada de las demás.
 *
 * Esta es la prueba que el plan define como criterio de «listo» de la ola 0.
 * Si no hay `DATABASE_URL_APP` se avisa y se omite —pero omitirla no es
 * aprobarla.
 */
async function verifyTenantIsolation(admin: postgres.Sql, schoolId: string) {
  console.log("\n─── Aislamiento entre escuelas ─────────────────────────────");

  const appUrl = process.env.DATABASE_URL_APP;
  if (!appUrl) {
    logger.warn(
      "OMITIDA: falta DATABASE_URL_APP. Sin ella no se comprueba el aislamiento. " +
        "Configúrala antes de fiarte.",
    );
    return;
  }

  const totals = await admin<Array<{ students: string; sessions: string; invoices: string }>>`
    SELECT
      (SELECT count(*) FROM student_profiles)::text AS students,
      (SELECT count(*) FROM sessions)::text         AS sessions,
      (SELECT count(*) FROM invoices)::text         AS invoices
  `;

  const app = postgres(appUrl, { max: 1, onnotice: () => {} });
  const failures: string[] = [];

  try {
    // 1. Con el contexto fijado, solo se ve esa escuela.
    const scoped = await app.begin(async (tx) => {
      await tx`SELECT set_config('app.school_id', ${schoolId}, true)`;
      const [row] = await tx<Array<{ students: string; sessions: string; invoices: string; schools: string }>>`
        SELECT
          (SELECT count(*) FROM student_profiles)::text AS students,
          (SELECT count(*) FROM sessions)::text         AS sessions,
          (SELECT count(*) FROM invoices)::text         AS invoices,
          (SELECT count(*) FROM schools)::text          AS schools
      `;
      return row!;
    });

    const totalStudents = Number(totals[0]!.students);
    if (Number(scoped.students) >= totalStudents) {
      failures.push(
        `Con contexto fijado se ven ${scoped.students} alumnos y en total hay ${totalStudents}: no se está filtrando.`,
      );
    } else {
      console.log(
        `  ok    Con contexto: ${scoped.students}/${totals[0]!.students} alumnos, ` +
          `${scoped.sessions}/${totals[0]!.sessions} clases, ` +
          `${scoped.invoices}/${totals[0]!.invoices} facturas`,
      );
    }

    // 2. Sin contexto no se ve absolutamente nada.
    const [unscoped] = await app<Array<{ students: string; sessions: string }>>`
      SELECT
        (SELECT count(*) FROM student_profiles)::text AS students,
        (SELECT count(*) FROM sessions)::text         AS sessions
    `;
    if (unscoped!.students !== "0" || unscoped!.sessions !== "0") {
      failures.push(
        `Sin contexto se ven ${unscoped!.students} alumnos y ${unscoped!.sessions} clases: debería ser 0.`,
      );
    } else {
      console.log("  ok    Sin contexto: 0 filas visibles");
    }

    // 3. No se puede escribir en otra escuela aunque se indique su id a mano.
    const [other] = await admin<Array<{ id: string }>>`
      SELECT id FROM schools WHERE id <> ${schoolId} LIMIT 1
    `;
    if (other) {
      let blocked = false;
      try {
        await app.begin(async (tx) => {
          await tx`SELECT set_config('app.school_id', ${schoolId}, true)`;
          await tx`
            INSERT INTO courses (school_id, code, language, level, modality, price_cents)
            VALUES (${other.id}, 'FUGA-TEST', 'es', 'A1', 'group', 1)
          `;
        });
      } catch {
        blocked = true;
      }
      if (blocked) {
        console.log("  ok    Escribir en otra escuela: rechazado por la política");
      } else {
        failures.push(
          "Se pudo insertar una fila con el school_id de otra escuela: falta WITH CHECK.",
        );
        await admin`DELETE FROM courses WHERE code = 'FUGA-TEST'`;
      }
    }

    // 4. El contexto no sobrevive a la transacción (no se filtra por el pool).
    const [leaked] = await app<Array<{ v: string | null }>>`
      SELECT nullif(current_setting('app.school_id', true), '') AS v
    `;
    if (leaked!.v) {
      failures.push(
        `El contexto de escuela persiste fuera de la transacción (${leaked!.v}): usa set_config(..., true).`,
      );
    } else {
      console.log("  ok    El contexto no sobrevive a la transacción");
    }
  } finally {
    await app.end();
  }

  if (failures.length > 0) {
    logger.error(`FUGA ENTRE ESCUELAS:\n${failures.map((f) => `    - ${f}`).join("\n")}`);
    process.exitCode = 1;
    return;
  }
  console.log("  Aislamiento verificado.");
}

main().catch((err) => {
  // Sin `catch` aquí, un fallo del seed se traga con un `unhandledRejection`
  // que Node imprime a su manera, no a la nuestra: exactamente el silencio
  // que la Tarea 8c prohíbe, y encima en el peor sitio, un despliegue.
  logger.error({ err }, "El seed ha fallado");
  process.exit(1);
});
