import type { RubricCriterion } from "../model/rubric.vo.js";
import type { ContentUnitId, ExerciseId } from "../model/identifiers.js";

/**
 * Lo que `assessment` necesita saber de un ejercicio de `learning` para
 * corregir un intento. Escrito en el lenguaje de `assessment` —no es
 * `Exercise`, ni trae nada que `assessment` no vaya a usar—: sigue el patrón
 * de `TeachesStudentPort` hacia `scheduling`
 * (`ARCHITECTURE.md`, «Puerto + capa anticorrupción»).
 *
 * `assessment` NO importa `learning/domain/ports/content-generator.port.ts`
 * ni ningún otro fichero de `learning/domain/`: ese es exactamente el
 * ejemplo de lo que no se hace (`ARCHITECTURE.md`, «Superficie pública de un
 * contexto»). Este puerto es la vía correcta — lo declara e implementa
 * `assessment`, y su adaptador solo hace SQL de lectura contra `exercises` /
 * `rubrics`, igual que `DrizzleTeachesStudentRepository` lee `sessions` /
 * `attendance` de `scheduling`.
 */
export interface ExerciseSourceInfo {
  type: string;
  /** `null` si el tipo no promete solución automática (rúbrica, o `shadowing`). */
  solution: Record<string, unknown> | null;
  rubricId: string | null;
  rubricCode: string | null;
  rubricMaxScore: number | null;
  rubricCriteria: readonly RubricCriterion[] | null;
  requiresTeacherValidation: boolean;
  maxAttempts: number;
  maxScore: number;
  language: string;
  level: string;
  /** `prompt.task`, para los tipos con rúbrica: el enunciado que corrige `WritingCorrectorPort`. */
  task: string | null;
}

/**
 * Lo que `assessment` necesita de una unidad didáctica PUBLICADA para generar
 * un examen (Tarea 15 de la ola 2): su nivel, sus destrezas y los ejercicios
 * de práctica que ya tiene (solo `id`/`type`/`skill`/`prompt` — lo justo para
 * comprobar que ningún ítem del examen es una copia literal). `status` viaja
 * tal cual para que el agregado (que no consulta la base de datos) sea quien
 * decida si puede examinar de una unidad en borrador — no este puerto.
 */
export interface ExamSourceExercise {
  id: string;
  type: string;
  skill: string | null;
  prompt: Record<string, unknown>;
}

export interface ExamSourceUnit {
  id: string;
  language: string;
  level: string;
  status: string;
  topic: string;
  exercises: readonly ExamSourceExercise[];
}

export interface ExerciseSourcePort {
  /** `null` si el ejercicio no existe (o no es de esta escuela: RLS lo oculta). */
  get(exerciseId: ExerciseId): Promise<ExerciseSourceInfo | null>;

  /**
   * Las unidades pedidas que de verdad existen en esta escuela. Las que no
   * existan simplemente no aparecen en el resultado — comprobar que la
   * lista devuelta tiene el mismo tamaño que `contentUnitIds` es cosa de
   * quien llama, no de este puerto.
   */
  getUnits(contentUnitIds: readonly ContentUnitId[]): Promise<readonly ExamSourceUnit[]>;

  /**
   * Rúbrica por código (`mcer-escrita`, `mcer-oral`…), para los ítems del
   * examen que se corrigen con rúbrica igual que `written_production` /
   * `spoken_production`. `null` si esta escuela no tiene esa rúbrica.
   */
  getRubricByCode(
    code: string,
  ): Promise<{ id: string; maxScore: number; criteria: readonly RubricCriterion[] } | null>;
}

export const EXERCISE_SOURCE_PORT = Symbol("ExerciseSourcePort");
