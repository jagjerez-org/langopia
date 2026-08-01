/**
 * Extensiones de Postgres que el esquema necesita ANTES de crearlo.
 *
 *   npm run db:push   (que es lo que usa `npm run db:reset`)
 *
 * `drizzle-kit push` compara el esquema y emite el DDL, pero no sabe crear
 * extensiones: una columna `vector(1024)` (`content_material_chunks`, tarea
 * 14 de la ola 2) falla con «type "vector" does not exist» si `pgvector` no
 * está instalada todavía. En el camino de despliegue eso lo resuelve la
 * propia migración (`drizzle/0007_material_propio.sql` empieza por
 * `CREATE EXTENSION IF NOT EXISTS vector`), pero `push` no ejecuta
 * migraciones — de ahí este paso, que corre justo antes.
 *
 * Idempotente y con el rol dueño, igual que `apply-policies.ts`: crear una
 * extensión no es algo que la aplicación (`langopia_app`) pueda ni deba hacer.
 */
import postgres from "postgres";

/** Cada extensión con el motivo por el que está: una lista sin motivos se llena de cosas que nadie se atreve a quitar. */
const EXTENSIONS: Record<string, string> = {
  vector: "pgvector: tipo `vector(n)` e índices de distancia de `content_material_chunks`",
};

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL.");

  const sql = postgres(url, { max: 1 });
  try {
    for (const [name, reason] of Object.entries(EXTENSIONS)) {
      await sql.unsafe(`CREATE EXTENSION IF NOT EXISTS ${name}`);
      console.log(`  extensión ${name} lista — ${reason}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
