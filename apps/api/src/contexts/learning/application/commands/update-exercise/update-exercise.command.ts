import { Command } from "@nestjs/cqrs";

/**
 * Edita el `prompt`/`solution` de un ejercicio ya generado (Tarea 11 del
 * panel, Paso 3: «los ejercicios editables uno a uno»).
 *
 * Sin tocar tipo, rúbrica ni posición: eso son decisiones de la generación,
 * no de una corrección de un enunciado o de una clave de respuesta.
 */
export class UpdateExerciseCommand extends Command<{ exerciseId: string }> {
  constructor(
    readonly props: {
      contentUnitId: string;
      exerciseId: string;
      prompt: Record<string, unknown>;
      solution?: Record<string, unknown>;
    },
  ) {
    super();
  }
}
