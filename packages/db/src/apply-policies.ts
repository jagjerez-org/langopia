/**
 * Aplica `policies.sql` y comprueba que ninguna tabla queda sin protección.
 * Ejecutar después de cada migración.
 *
 *   npm run db:policies
 *
 * La comprobación anterior solo miraba las tablas con columna `school_id`, y
 * por eso cantaba «sin tablas desprotegidas» mientras `schools` —la raíz del
 * tenant, que se aísla por `id`— estaba sin RLS y sin política. Una
 * comprobación que solo sabe mirar donde ya sabes que hay problema no es una
 * comprobación.
 *
 * Ahora el criterio va al revés: **toda** tabla de `public` tiene que caer en
 * una de tres categorías declaradas, y la que no encaje hace fallar el script.
 * Añadir una tabla nueva obliga a decir en cuál está.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

const here = __dirname;

/**
 * Tablas que se aíslan por su propio `id` en vez de por `school_id`.
 * Hoy solo hay una, y no debería haber más: el tenant es la escuela.
 */
const TENANT_ROOT: Record<string, string> = {
  schools: "raíz del tenant: la política compara `id` con `app.school_id`",
};

/**
 * Tablas GLOBALES a propósito. Cada una lleva su motivo escrito: es la
 * diferencia entre «global por decisión» y «desprotegida por olvido», que es
 * justo la distinción que la comprobación vieja no sabía hacer.
 *
 * Estar aquí no exime de RLS —todas la llevan activada—; exime de tener que
 * llevar `school_id`.
 */
const GLOBAL_TABLES: Record<string, string> = {
  users:
    "identidad global: una persona puede dar clase en dos escuelas. Su política " +
    "la hace visible solo desde una escuela donde tenga membresía",
  plans: "catálogo de planes de la plataforma: legible por todos, no escribible desde la aplicación",
  user: "credencial de Better Auth: RLS activada SIN política y permisos revocados a langopia_app",
  session: "sesión de Better Auth: RLS activada SIN política y permisos revocados a langopia_app",
  account: "credencial externa de Better Auth: RLS activada SIN política y permisos revocados",
  verification: "verificación de Better Auth: RLS activada SIN política y permisos revocados",
  platform_support_staff:
    "soporte de la plataforma (Tarea 17): impersona en cualquier escuela, no es un rol de " +
    "ninguna en particular. RLS activada SIN política y permisos revocados a langopia_app: " +
    "solo la lee la función SECURITY DEFINER is_platform_support",
};

/** Tablas que a propósito NO tienen política: el resultado por defecto es no ver nada. */
const DENY_ALL_BY_DESIGN = new Set(["user", "session", "account", "verification", "platform_support_staff"]);

/**
 * Tablas append-only: `langopia_app` puede escribirlas y leerlas, nunca
 * reescribirlas ni borrarlas.
 *
 * La comprobación de RLS de abajo mira quién ve QUÉ filas; esta mira qué
 * puede HACER con ellas, que es una pregunta distinta y hasta ahora no se
 * hacía. `GRANT … ON ALL TABLES` reparte `UPDATE` y `DELETE` a todo lo que
 * haya, así que la protección de `audit_logs` es un `REVOKE` explícito en
 * `policies.sql` — exactamente la clase de línea que un `GRANT` posterior
 * deshace sin que nadie se entere. Esto lo convierte en un fallo de
 * `npm run db:policies`.
 */
const APPEND_ONLY_TABLES: Record<string, string> = {
  audit_logs:
    "registro de auditoría: si la aplicación puede reescribirlo o borrarlo, no prueba nada. " +
    "Solo INSERT y SELECT",
};

const FORBIDDEN_PRIVILEGES = ["UPDATE", "DELETE"] as const;

type TableRow = {
  tabla: string;
  rls: boolean;
  politicas: number;
  tiene_school_id: boolean;
};

function passwordFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.password) || undefined;
  } catch {
    return undefined;
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");

  const appPassword =
    process.env.APP_DATABASE_PASSWORD ??
    passwordFromUrl(process.env.DATABASE_URL_APP) ??
    "cambiame";
  const sqlText = (await readFile(join(here, "policies.sql"), "utf8")).replace(
    /\$\{APP_DATABASE_PASSWORD\}/g,
    appPassword.replace(/'/g, "''"),
  );
  const client = postgres(url, { max: 1, onnotice: () => {} });

  try {
    await client.unsafe(sqlText);
    console.log("Políticas aplicadas.");

    const tables = await client<TableRow[]>`
      SELECT c.relname AS tabla,
             c.relrowsecurity AS rls,
             (SELECT count(*)::int FROM pg_policies p
               WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS politicas,
             EXISTS (SELECT 1 FROM pg_attribute a
                      WHERE a.attrelid = c.oid AND a.attname = 'school_id'
                        AND NOT a.attisdropped) AS tiene_school_id
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY 1
    `;

    const failures: string[] = [];
    let porSchoolId = 0;
    let raiz = 0;
    let globales = 0;

    for (const t of tables) {
      // 1. RLS activada, sin excepciones. Sin esto la política da igual.
      if (!t.rls) {
        failures.push(`${t.tabla}: RLS desactivada (ALTER TABLE … ENABLE ROW LEVEL SECURITY)`);
        continue;
      }

      // 2. Cada tabla en una de las tres categorías, ninguna sin clasificar.
      if (t.tiene_school_id) {
        porSchoolId++;
        if (t.politicas === 0) failures.push(`${t.tabla}: tiene school_id y ninguna política`);
      } else if (t.tabla in TENANT_ROOT) {
        raiz++;
        if (t.politicas === 0) failures.push(`${t.tabla}: raíz del tenant y ninguna política`);
      } else if (t.tabla in GLOBAL_TABLES) {
        globales++;
        if (t.politicas === 0 && !DENY_ALL_BY_DESIGN.has(t.tabla)) {
          failures.push(`${t.tabla}: declarada global pero sin política ni denegación explícita`);
        }
      } else {
        failures.push(
          `${t.tabla}: sin columna school_id y sin clasificar. Si es del tenant, dale ` +
            "school_id; si es global, decláralo en GLOBAL_TABLES con su motivo; si se " +
            "aísla por su id, en TENANT_ROOT.",
        );
      }
    }

    for (const [tabla, motivo] of Object.entries(APPEND_ONLY_TABLES)) {
      const existe = tables.some((t) => t.tabla === tabla);
      if (!existe) {
        failures.push(`${tabla}: declarada append-only pero no existe en el esquema`);
        continue;
      }
      for (const privilegio of FORBIDDEN_PRIVILEGES) {
        const [row] = await client<{ tiene: boolean }[]>`
          SELECT has_table_privilege('langopia_app', ${`public.${tabla}`}, ${privilegio}) AS tiene
        `;
        if (row?.tiene) {
          failures.push(
            `${tabla}: langopia_app conserva ${privilegio} sobre una tabla append-only (${motivo})`,
          );
        }
      }
    }

    if (failures.length > 0) {
      console.error("\nTablas sin protección o sin clasificar:");
      for (const f of failures) console.error(`  - ${f}`);
      console.error("\nCada una es una vía de fuga entre escuelas.");
      process.exitCode = 1;
      return;
    }

    const counts = await client<{ n: string }[]>`
      SELECT count(*)::text AS n FROM pg_policies WHERE schemaname = 'public'
    `;
    console.log(
      `Sin tablas desprotegidas: ${porSchoolId} por school_id, ${raiz} raíz del tenant, ` +
        `${globales} globales declaradas. ${counts[0]?.n ?? "0"} políticas activas.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
