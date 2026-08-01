/**
 * Formas que devuelven los endpoints que consume «hacer ejercicios» (Tarea 12
 * de la ola 2):
 *
 * · `GET /assessments/students/:id/exercises` → `ExerciseToDo[]`
 *   (`assessment/application/ports/student-progress-read-model.port.ts`).
 * · `POST /assessments/attempts` → `SubmitAttemptResult`
 *   (`.../commands/submit-attempt/submit-attempt.command.ts`).
 * · `GET /assessments/attempts/pending` → `PendingAttemptEntry[]`
 *   (`.../ports/assessment-read-model.port.ts`).
 * · `GET /learning/students/:id/due-cards` → `DueCard[]`
 *   (`learning/.../queries/get-due-cards/get-due-cards.handler.ts`).
 *
 * Se declaran aquí y no en `@langopia/contracts` por el mismo motivo que
 * `features/content/types.ts` y `features/exams/types.ts`: ni `assessment` ni
 * `learning` han publicado todavía sus tipos en ese paquete. El día que lo
 * hagan, este fichero pasa a ser un reexport y ninguna pantalla cambia.
 */

/** Espejo de `exercise_type`, en el mismo orden que `ExerciseType` del dominio. */
export const EXERCISE_TYPES = [
  "cloze",
  "multiple_choice",
  "matching",
  "ordering",
  "minimal_pairs",
  "dictation",
  "shadowing",
  "listening_comprehension",
  "reading_comprehension",
  "written_production",
  "spoken_production",
] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

/**
 * Lo que un componente de ejercicio devuelve y viaja tal cual en el cuerpo de
 * `POST /assessments/attempts`. La API la valida como `Record<string, unknown>`
 * (`SubmitAttemptDto.response`, `@IsNotEmptyObject()`): la forma concreta
 * depende del tipo, y la decide `scoreAutomatically` comparando clave a clave
 * con la `solution` — que nunca sale del servidor.
 */
export type ExerciseResponse = Record<string, unknown>;

/** El último intento de un ejercicio, tal como lo sirve el modelo de lectura. */
export interface LatestAttempt {
  attemptId: string;
  status: string;
  attemptNumber: number;
  aiScore: number | null;
  aiFeedback: string | null;
  teacherScore: number | null;
  teacherFeedback: string | null;
  response: ExerciseResponse;
}

export interface ExerciseToDo {
  exerciseId: string;
  contentUnitId: string;
  unitCode: string;
  type: string;
  skill: string;
  prompt: Record<string, unknown>;
  maxScore: number;
  /**
   * Lo decide la API (el ejercicio exige rúbrica), NUNCA el panel deduciéndolo
   * del tipo: mientras sea `true`, la nota no cuenta hasta que el profesor
   * firme, aunque haya `aiScore`.
   */
  requiresTeacherValidation: boolean;
  srsEnabled: boolean;
  /** `null`: el alumno no lo ha intentado todavía. */
  latestAttempt: LatestAttempt | null;
}

export interface SubmitAttemptInput {
  exerciseId: string;
  studentProfileId: string;
  response: ExerciseResponse;
}

export interface SubmitAttemptResult {
  attemptId: string;
  status: string;
  /** `null`: todavía no hay corrección automática (rúbrica sin texto, o falló). */
  aiScore: number | null;
  aiFeedback: string | null;
  maxScore: number;
  requiresTeacherValidation: boolean;
}

export interface PendingAttemptEntry {
  attemptId: string;
  exerciseId: string;
  exerciseType: string;
  skill: string;
  prompt: Record<string, unknown>;
  response: ExerciseResponse;
  maxScore: number;
  studentProfileId: string;
  studentName: string;
  status: string;
  attemptNumber: number;
  aiScore: number | null;
  aiFeedback: string | null;
  submittedAt: string;
}

export interface DueCard {
  id: string;
  exerciseId: string;
  ease: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  /** Fecha sin hora (`date` en la base), ya resuelta en la zona de la escuela. */
  dueOn: string;
  lastReviewedAt: string | null;
}

/** Cuerpo de `POST /assessments/attempts/:id/validate` (`ValidateAttemptDto`). */
export interface ValidateAttemptInput {
  teacherScore: number;
  teacherFeedback?: string;
}

/** Cuerpo de `POST /assessments/attempts/:id/return` (`ReturnAttemptDto`). */
export interface ReturnAttemptInput {
  teacherFeedback: string;
}
