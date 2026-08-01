/**
 * Modelo de lectura de Assessment.
 *
 * Igual que `SchedulingReadModel` con la ocupación del profesorado: cruza
 * `evaluations` con `student_profiles` y `memberships`/`users` de otro
 * contexto con SQL directo en su propia capa de infraestructura, sin cargar
 * agregados. El aislamiento entre escuelas lo sigue dando RLS.
 */

export type StudentWithoutEvaluation = {
  studentId: string;
  name: string;
  joinedAt: string;
  /** `null`: a este alumno no se le ha hecho nunca ninguna valoración. */
  weeksSinceLastEvaluation: number | null;
};

/**
 * Un intento que sigue esperando la firma del profesor (tarea 12 de la ola
 * 2: bandeja del profesor): en `submitted` (sin corrección automática
 * disponible) o en `ai_graded` (la IA ya propuso, falta que alguien firme).
 * Trae el `prompt` del ejercicio y la `response` del alumno para que el
 * profesor pueda revisar sin una segunda consulta — nunca `solution`, que no
 * hace falta para firmar (el profesor decide con su propio criterio, no
 * comparando contra la solución automática).
 */
export type PendingAttemptEntry = {
  attemptId: string;
  exerciseId: string;
  exerciseType: string;
  skill: string;
  prompt: Record<string, unknown>;
  response: Record<string, unknown>;
  maxScore: number;
  studentProfileId: string;
  studentName: string;
  status: string;
  attemptNumber: number;
  aiScore: number | null;
  aiFeedback: string | null;
  submittedAt: string;
};

export interface AssessmentReadModel {
  /**
   * Alumnado activo sin una valoración en las últimas `weeks` semanas (o sin
   * ninguna nunca). Es la consulta que alimenta el panel de dirección: dice
   * quién está sin valorar.
   */
  studentsWithoutRecentEvaluation(params: { weeks: number; now: Date }): Promise<StudentWithoutEvaluation[]>;

  /**
   * Intentos pendientes de firma, el más antiguo primero, hasta `limit`.
   * Igual que `studentsWithoutRecentEvaluation`: sin acotar por profesor
   * concreto (mismo criterio ya establecido — es la señal que alimenta un
   * panel, no un dato personal de un único profesor), el aislamiento entre
   * escuelas lo sigue dando RLS.
   */
  pendingValidation(params: { limit: number }): Promise<PendingAttemptEntry[]>;
}

export const ASSESSMENT_READ_MODEL = Symbol("AssessmentReadModel");
