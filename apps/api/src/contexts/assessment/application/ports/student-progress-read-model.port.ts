import type { ProgressTrendPoint, SkillProgress } from "../queries/get-student-progress/progress-math.js";

/**
 * Modelo de lectura del progreso del alumno (tarea 16 de la ola 2).
 *
 * Igual que `AssessmentReadModel` (con `evaluations`) y `PortalReadModel`
 * (con `catalog`, `scheduling`, `billing`): SQL directo en su propia capa de
 * infraestructura, cruzando `attempts`/`exercises` (propias de este
 * contexto) con `content_units` (`learning`), `groups`/`enrollments`
 * (`catalog`) y `srs_cards` (`learning`) — sin cargar agregados, sin repetir
 * ninguna decisión de negocio ajena (publicar una unidad, validar un
 * intento, repasar una tarjeta ya la tomó quien la tomó; esto solo LEE el
 * resultado). El aislamiento entre escuelas lo sigue dando RLS.
 */
export type StudentProgress = {
  publishedExercises: number;
  completedExercises: number;
  /** `null`: todavía no hay ningún ejercicio publicado a los grupos del alumno. */
  completionRate: number | null;
  validatedAttempts: number;
  /** `null`: todavía no hay ningún intento validado por el profesor. */
  averageScore: number | null;
  skillBreakdown: SkillProgress[];
  trend: ProgressTrendPoint[];
  reviewStreakDays: number;
};

/**
 * Un ejercicio publicado a los grupos activos del alumno, tal como lo
 * necesita la pantalla de «hacer ejercicios» (tarea 12 de la ola 2): el
 * `prompt` completo (nunca `solution`, que no sale de `learning`) y, si ya
 * hay un intento, su último estado — para que el alumno vea de un vistazo
 * qué le queda por hacer, qué está corregido y qué sigue pendiente de firma.
 *
 * Mismo criterio que `completionCounts` de esta misma clase: `contentUnitId`
 * y `exercises` son de `learning`; `groups`/`enrollments`/`courses`, de
 * `catalog`. Sin `solution` ni rúbrica: esto es lo que el alumno puede ver.
 */
export type ExerciseToDo = {
  exerciseId: string;
  contentUnitId: string;
  unitCode: string;
  type: string;
  skill: string;
  prompt: Record<string, unknown>;
  maxScore: number;
  requiresTeacherValidation: boolean;
  srsEnabled: boolean;
  /** `null`: el alumno no lo ha intentado todavía. */
  latestAttempt: {
    attemptId: string;
    status: string;
    attemptNumber: number;
    aiScore: number | null;
    aiFeedback: string | null;
    teacherScore: number | null;
    teacherFeedback: string | null;
    response: Record<string, unknown>;
  } | null;
};

export interface StudentProgressReadModel {
  getProgress(params: { studentId: string; now: Date }): Promise<StudentProgress>;

  /** Ejercicios publicados a los grupos activos del alumno, con su último intento si lo hay. */
  exercisesForStudent(studentId: string): Promise<ExerciseToDo[]>;
}

export const STUDENT_PROGRESS_READ_MODEL = Symbol("StudentProgressReadModel");
