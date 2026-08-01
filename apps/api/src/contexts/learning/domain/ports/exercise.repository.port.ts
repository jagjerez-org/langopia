import type { ExerciseType } from "../model/exercise-schemas.js";
import type { ExerciseId } from "../model/identifiers.js";

/** Lo justo de un ejercicio persistido para revalidarlo y saber a qué unidad pertenece. */
export type ExerciseRecord = {
  id: string;
  contentUnitId: string;
  type: ExerciseType;
};

/**
 * Repositorio de `Exercise`, aparte de `ContentUnitRepository` (Tarea 6:
 * ahí solo se guarda la IDENTIDAD del ejercicio, vía `addExercises`). La
 * Tarea 11 del panel necesita releer y actualizar UN ejercicio suelto —
 * editar su `prompt`/`solution` durante la revisión— sin tocar la interfaz
 * de `ContentUnitRepository` que ya implementan los dobles de
 * `generate-unit.handler.spec.ts`, `publish-unit.handler.spec.ts` y
 * `on-attempt-ai-graded.handler.spec.ts`.
 */
export interface ExerciseRepositoryPort {
  /** `null` si no existe (o RLS lo oculta). */
  findById(exerciseId: ExerciseId): Promise<ExerciseRecord | null>;

  /**
   * Sobrescribe `prompt`/`solution`. Sin validar nada aquí: quien llama
   * (`UpdateExerciseHandler`) ya pasó por `validateExercise()` — la MISMA
   * que usa `Exercise.create()` — antes de llamar a este método.
   */
  updateContent(
    exerciseId: ExerciseId,
    params: { prompt: Record<string, unknown>; solution?: Record<string, unknown> | null },
  ): Promise<void>;
}

export const EXERCISE_REPOSITORY = Symbol("ExerciseRepositoryPort");
