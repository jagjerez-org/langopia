import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export type Db = PostgresJsDatabase<typeof schema>;

/**
 * Conexión con el rol DUEÑO. Salta las políticas RLS.
 *
 * Solo para migraciones, aplicación de políticas y seed. Nunca en código que
 * atienda una petición de usuario.
 */
export function createAdminDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("Falta DATABASE_URL");
  const client = postgres(url, { max: 4, onnotice: () => {} });
  return { db: drizzle(client, { schema }), client };
}

/**
 * Conexión de la aplicación, con el rol `langopia_app` (sin BYPASSRLS).
 */
export function createAppDb(url = process.env.DATABASE_URL_APP) {
  if (!url) throw new Error("Falta DATABASE_URL_APP");
  const client = postgres(url, { max: 10, onnotice: () => {} });
  return { db: drizzle(client, { schema }), client };
}

/**
 * Ejecuta `fn` dentro de una transacción con el contexto de escuela fijado.
 *
 * Todo acceso a datos de la aplicación pasa por aquí. `set_config(..., true)`
 * hace la variable local a la transacción, de modo que la siguiente petición
 * que reutilice esa conexión del pool no hereda el tenant de la anterior
 * —que es exactamente el fallo que produciría una fuga entre escuelas.
 */
export async function withTenant<T>(
  db: Db,
  ctx: { schoolId: string; membershipId?: string },
  fn: (tx: Db) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.school_id', ${ctx.schoolId}, true)`);
    await tx.execute(
      sql`SELECT set_config('app.membership_id', ${ctx.membershipId ?? ""}, true)`,
    );
    return fn(tx as unknown as Db);
  });
}

export { schema };
