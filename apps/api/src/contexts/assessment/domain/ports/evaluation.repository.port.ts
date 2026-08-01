import type { Evaluation } from "../model/evaluation.aggregate.js";
import type { EvaluationId, StudentId, TeacherId } from "../model/identifiers.js";

/**
 * Repositorio de la raíz de agregado.
 *
 * Habla en objetos de dominio, no en filas. No hay método `update`: se carga
 * el agregado, se le pide que haga algo, y se guarda.
 */
export interface EvaluationRepository {
  find(id: EvaluationId): Promise<Evaluation | null>;

  /** Como `find`, pero lanza `NotFoundError` si no existe. */
  findOrFail(id: EvaluationId): Promise<Evaluation>;

  save(evaluation: Evaluation): Promise<void>;

  /**
   * Valoraciones de este profesor a este alumno. Lo usa el manejador del
   * comando para comprobar que el periodo nuevo no se solapa con ninguna.
   */
  findByTeacherAndStudent(params: { teacherId: TeacherId; studentId: StudentId }): Promise<Evaluation[]>;
}

export const EVALUATION_REPOSITORY = Symbol("EvaluationRepository");
