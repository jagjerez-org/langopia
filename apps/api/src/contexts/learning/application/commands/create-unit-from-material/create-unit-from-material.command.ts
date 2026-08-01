import type { ICommand } from "@nestjs/cqrs";

/**
 * Crea una unidad `hybrid` a partir de un material propio ya subido e
 * indexado: material propio como fuente, ejercicios generados encima.
 *
 * Distinto de `GenerateUnitCommand` (que genera una unidad enteramente desde
 * un tema, sin material real detrás): aquí el `sourceMaterial` que recibe el
 * modelo no es libre — son fragmentos reales del material que la escuela
 * subió, recuperados por cercanía semántica (`pgvector`) al `topic`/`skills`
 * pedidos.
 */
export class CreateUnitFromMaterialCommand implements ICommand {
  constructor(
    readonly props: {
      materialId: string;
      code: string;
      language: string;
      level: string;
      topic: string;
      skills: string[];
      primaryLocale: string;
      exerciseTypes: string[];
    },
  ) {}
}
