import { Command } from "@nestjs/cqrs";

/**
 * Genera una unidad didáctica completa con IA: texto, ejercicios y (cuando
 * exista un proveedor real conectado — tarea 4) audio e imagen.
 *
 * `exerciseTypes` fija tanto los tipos como el número de ejercicios: un
 * elemento por ejercicio que se pide (se admite repetir un tipo). No incluye
 * `dictation`, `shadowing` ni `listening_comprehension`: esos tres exigen que
 * la unidad ya tenga un recurso de audio real (`Exercise.create()`,
 * tarea 2), y hoy no hay ningún proveedor de audio conectado a este caso de
 * uso (ver el informe de la tarea 6) — pedirlos haría fallar la generación
 * entera después de gastar la llamada al modelo, no antes.
 */
export class GenerateUnitCommand extends Command<{ contentUnitId: string; status: string }> {
  constructor(
    readonly props: {
      code: string;
      language: string;
      level: string;
      topic: string;
      skills: string[];
      primaryLocale: string;
      exerciseTypes: string[];
      sourceMaterial?: string;
      /**
       * De dónde sale el material de partida. `ai_generated` (el valor por
       * defecto, y el único que puede pedir el endpoint HTTP) es una unidad
       * inventada desde el tema; `hybrid` la pide
       * `CreateUnitFromMaterialHandler` (tarea 14 de la ola 2) cuando el
       * `sourceMaterial` son fragmentos reales del material que subió la
       * escuela. Los dos nacen en `in_review`: lo que cambia es la
       * procedencia, no quién firma.
       */
      source?: "ai_generated" | "hybrid";
    },
  ) {
    super();
  }
}
