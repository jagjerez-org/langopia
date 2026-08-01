import type { Attempt } from "../model/attempt.aggregate.js";
import type { AttemptId, ExerciseId } from "../model/identifiers.js";

/**
 * Repositorio de la raíz de agregado.
 *
 * Habla en objetos de dominio, no en filas. No hay método `update`: se carga
 * el agregado, se le pide que haga algo, y se guarda.
 */
export interface AttemptRepository {
  find(id: AttemptId): Promise<Attempt | null>;

  /** Como `find`, pero lanza `NotFoundError` si no existe. */
  findOrFail(id: AttemptId): Promise<Attempt>;

  save(attempt: Attempt): Promise<void>;

  /**
   * Cuántos intentos previos hay ya de este alumno sobre este ejercicio. Lo
   * usa el manejador de `submit-attempt` para calcular el `attemptNumber`
   * siguiente — un agregado nunca cuenta filas por sí mismo.
   */
  countForExerciseAndStudent(params: { exerciseId: ExerciseId; studentProfileId: string }): Promise<number>;

  /**
   * Intentos que siguen en `ai_graded` desde antes de `submittedBefore`. Lo
   * usa `NotifyOverdueAttemptsJob` para detectar correcciones sin firmar que
   * llevan más de 7 días esperando al profesor — la nota sigue sin contar,
   * y nadie lo ha notado todavía.
   */
  findAiGradedSubmittedBefore(submittedBefore: Date): Promise<Attempt[]>;
}

export const ATTEMPT_REPOSITORY = Symbol("AttemptRepository");
