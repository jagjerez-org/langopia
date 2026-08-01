import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type {
  ExerciseToDo,
  StudentProgress,
  StudentProgressReadModel,
} from "../../application/ports/student-progress-read-model.port.js";
import {
  computeAverageScore,
  computeCompletionRate,
  computeReviewStreak,
  computeSkillBreakdown,
  computeTrend,
  type ValidatableAttempt,
} from "../../application/queries/get-student-progress/progress-math.js";

const DEFAULT_TIMEZONE = "Europe/Madrid";

/**
 * Modelo de lectura del progreso del alumno (tarea 16 de la ola 2).
 *
 * SQL directo, sin cargar agregados —igual que `DrizzleAssessmentReadModel`
 * y `PortalReadModel`—, cruzando tablas de tres contextos:
 *
 *   · `attempts`/`exercises`: propias de este contexto.
 *   · `content_units`, `srs_cards`: de `learning`.
 *   · `groups`, `enrollments`, `courses`: de `catalog`.
 *
 * Ninguna de las tres consultas repite una decisión de negocio ajena —
 * publicar una unidad, validar un intento o repasar una tarjeta ya la tomó
 * quien la tomó—; esto solo LEE el resultado ya persistido. El aislamiento
 * entre escuelas lo sigue dando RLS, no un `WHERE school_id` añadido aquí.
 * La aritmética de negocio (qué cuenta, cómo se promedia, qué es una racha)
 * vive en `progress-math.ts`, sola y con sus propias pruebas: esta clase solo
 * consigue las filas y se las pasa.
 */
@Injectable()
export class DrizzleStudentProgressReadModel implements StudentProgressReadModel {
  constructor(private readonly drizzle: DrizzleService) {}

  async getProgress(params: { studentId: string; now: Date }): Promise<StudentProgress> {
    const [completion, attempts, streak] = await Promise.all([
      this.completionCounts(params.studentId),
      this.attemptsForStudent(params.studentId),
      this.reviewStreak(params.studentId, params.now),
    ]);

    const { average, validatedCount } = computeAverageScore(attempts);

    return {
      publishedExercises: completion.published,
      completedExercises: completion.completed,
      completionRate: computeCompletionRate(completion.published, completion.completed),
      validatedAttempts: validatedCount,
      averageScore: average,
      skillBreakdown: computeSkillBreakdown(attempts),
      trend: computeTrend(attempts),
      reviewStreakDays: streak,
    };
  }

  /**
   * «Contenido completado» (tabla del brief, fila 1): ejercicios con intento
   * / ejercicios publicados a LOS GRUPOS ACTIVOS del alumno — el `course_id`
   * de una unidad publicada tiene que coincidir con el de alguno de esos
   * grupos. Una unidad sin curso asignado (`course_id` nulo) no cuenta para
   * nadie todavía: no está dirigida a ningún grupo.
   */
  private async completionCounts(
    studentId: string,
  ): Promise<{ published: number; completed: number }> {
    const rows = await this.drizzle.db.execute<{ published: number; completed: number }>(sql`
      WITH my_courses AS (
        SELECT DISTINCT g.course_id
        FROM enrollments e
        JOIN groups g ON g.id = e.group_id
        WHERE e.student_profile_id = ${studentId} AND e.status = 'active'
      ),
      published_exercises AS (
        SELECT ex.id
        FROM exercises ex
        JOIN content_units cu ON cu.id = ex.content_unit_id
        WHERE cu.status = 'published' AND cu.course_id IN (SELECT course_id FROM my_courses)
      )
      SELECT
        (SELECT count(*)::int FROM published_exercises) AS published,
        (SELECT count(DISTINCT a.exercise_id)::int
           FROM attempts a
           WHERE a.student_profile_id = ${studentId}
             AND a.exercise_id IN (SELECT id FROM published_exercises)) AS completed
    `);
    const row = rows[0];
    return { published: row?.published ?? 0, completed: row?.completed ?? 0 };
  }

  /**
   * Todos los intentos del alumno, de cualquier estado (el filtro de «solo
   * lo firmado» lo aplica `progress-math.ts`, no esta consulta): la nota
   * media, el desglose por destreza y la tendencia miran su historial
   * completo, no solo lo publicado a sus grupos ACTUALES — una nota ya
   * firmada no deja de contar porque el alumno cambie de grupo.
   */
  private async attemptsForStudent(studentId: string): Promise<ValidatableAttempt[]> {
    const rows = await this.drizzle.db.execute<{
      status: string;
      teacher_score: number | string | null;
      max_score: number;
      skill: string;
      week_start: string;
    }>(sql`
      SELECT
        a.status AS status,
        a.teacher_score AS teacher_score,
        ex.max_score AS max_score,
        ex.skill AS skill,
        (date_trunc('week', a.submitted_at)::date)::text AS week_start
      FROM attempts a
      JOIN exercises ex ON ex.id = a.exercise_id
      WHERE a.student_profile_id = ${studentId}
    `);
    return rows.map((row) => ({
      status: row.status,
      teacherScore: row.teacher_score === null ? null : Number(row.teacher_score),
      maxScore: row.max_score,
      skill: row.skill,
      weekStart: row.week_start,
    }));
  }

  /**
   * Ejercicios publicados a los grupos activos del alumno, con su último
   * intento si lo hay (tarea 12 de la ola 2: «hacer ejercicios»). Misma CTE
   * `my_courses`/`published_exercises` que `completionCounts`: el `course_id`
   * de una unidad publicada tiene que coincidir con el de alguno de los
   * grupos activos del alumno. `LEFT JOIN LATERAL` trae solo el intento MÁS
   * RECIENTE (mayor `attempt_number`) de cada ejercicio — el historial
   * completo no hace falta aquí, solo «¿qué me queda por hacer, ahora
   * mismo?».
   */
  async exercisesForStudent(studentId: string): Promise<ExerciseToDo[]> {
    const rows = await this.drizzle.db.execute<{
      exercise_id: string;
      content_unit_id: string;
      unit_code: string;
      type: string;
      skill: string;
      prompt: Record<string, unknown>;
      max_score: number;
      requires_teacher_validation: boolean;
      srs_enabled: boolean;
      attempt_id: string | null;
      attempt_status: string | null;
      attempt_number: number | null;
      ai_score: number | string | null;
      ai_feedback: string | null;
      teacher_score: number | string | null;
      teacher_feedback: string | null;
      response: Record<string, unknown> | null;
    }>(sql`
      WITH my_courses AS (
        SELECT DISTINCT g.course_id
        FROM enrollments e
        JOIN groups g ON g.id = e.group_id
        WHERE e.student_profile_id = ${studentId} AND e.status = 'active'
      )
      SELECT
        ex.id                          AS exercise_id,
        ex.content_unit_id             AS content_unit_id,
        cu.code                        AS unit_code,
        ex.type                        AS type,
        ex.skill                       AS skill,
        ex.prompt                      AS prompt,
        ex.max_score                   AS max_score,
        ex.requires_teacher_validation AS requires_teacher_validation,
        ex.srs_enabled                 AS srs_enabled,
        la.id                          AS attempt_id,
        la.status                     AS attempt_status,
        la.attempt_number              AS attempt_number,
        la.ai_score                    AS ai_score,
        la.ai_feedback                 AS ai_feedback,
        la.teacher_score               AS teacher_score,
        la.teacher_feedback            AS teacher_feedback,
        la.response                    AS response
      FROM exercises ex
      JOIN content_units cu ON cu.id = ex.content_unit_id
      LEFT JOIN LATERAL (
        SELECT a.*
        FROM attempts a
        WHERE a.exercise_id = ex.id AND a.student_profile_id = ${studentId}
        ORDER BY a.attempt_number DESC
        LIMIT 1
      ) la ON true
      WHERE cu.status = 'published' AND cu.course_id IN (SELECT course_id FROM my_courses)
      ORDER BY cu.code, ex.position
    `);

    return rows.map((row) => ({
      exerciseId: row.exercise_id,
      contentUnitId: row.content_unit_id,
      unitCode: row.unit_code,
      type: row.type,
      skill: row.skill,
      prompt: row.prompt,
      maxScore: row.max_score,
      requiresTeacherValidation: row.requires_teacher_validation,
      srsEnabled: row.srs_enabled,
      latestAttempt: row.attempt_id
        ? {
            attemptId: row.attempt_id,
            status: row.attempt_status!,
            attemptNumber: row.attempt_number!,
            aiScore: row.ai_score === null ? null : Number(row.ai_score),
            aiFeedback: row.ai_feedback,
            teacherScore: row.teacher_score === null ? null : Number(row.teacher_score),
            teacherFeedback: row.teacher_feedback,
            response: row.response ?? {},
          }
        : null,
    }));
  }

  /**
   * «Racha de repaso» (tabla del brief, fila 5): días seguidos (zona horaria
   * de LA ESCUELA, no del servidor) en los que el alumno repasó al menos una
   * tarjeta de repetición espaciada (`srs_cards.last_reviewed_at`). La
   * aritmética de qué es «seguidos», con su día de gracia, vive en
   * `computeReviewStreak`; aquí solo se resuelven «hoy» y el conjunto de días
   * con repaso, ambos en esa misma zona horaria.
   */
  private async reviewStreak(studentId: string, now: Date): Promise<number> {
    // `::text` en los dos casts finales, a propósito: sin él, `postgres-js`
    // devuelve un `date`/`date[]` como objetos `Date` (medianoche UTC), y
    // `computeReviewStreak` compara cadenas `YYYY-MM-DD` — un `Set` de
    // objetos `Date` nunca hace `.has()` con otro objeto `Date` distinto,
    // aunque sea el mismo día, así que la racha daba siempre 0. Verificado en
    // vivo contra el seed (ver el informe de esta tarea).
    const rows = await this.drizzle.db.execute<{ today: string; reviewed_days: string[] | null }>(sql`
      WITH tz AS (
        SELECT COALESCE((SELECT timezone FROM schools LIMIT 1), ${DEFAULT_TIMEZONE}) AS timezone
      )
      SELECT
        (${now.toISOString()}::timestamptz AT TIME ZONE (SELECT timezone FROM tz))::date::text AS today,
        array_agg(DISTINCT ((sc.last_reviewed_at AT TIME ZONE (SELECT timezone FROM tz))::date)::text) AS reviewed_days
      FROM srs_cards sc
      WHERE sc.student_profile_id = ${studentId} AND sc.last_reviewed_at IS NOT NULL
    `);
    const row = rows[0];
    if (!row) return 0;
    return computeReviewStreak(row.today, row.reviewed_days ?? []);
  }
}
