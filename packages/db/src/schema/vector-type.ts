import { customType } from "drizzle-orm/pg-core";

/**
 * Columna `vector(n)` de la extensión `pgvector` (tarea 14 de la ola 2:
 * indexado semántico de material propio). Drizzle no trae un tipo `vector`
 * de fábrica (a diferencia de `jsonb` o `text`), así que se declara con
 * `customType`: el mismo mecanismo que usa el propio Drizzle para tipos que
 * no están en el núcleo.
 *
 * Entrada y salida son un `number[]` normal — ni quien escribe ni quien lee
 * la columna necesita saber que por debajo viaja como el literal de texto
 * `[0.1,0.2,...]` que espera `pgvector` por cable.
 */
export const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    const inner = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
    if (inner.length === 0) return [];
    return inner.split(",").map(Number);
  },
});
