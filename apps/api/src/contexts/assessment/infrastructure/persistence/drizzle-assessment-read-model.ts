import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type {
  AssessmentReadModel,
  PendingAttemptEntry,
  StudentWithoutEvaluation,
} from "../../application/ports/assessment-read-model.port.js";

const WEEK_MS = 7 * 24 * 3_600_000;

/**
 * Lado de lectura. Igual que `DrizzleSchedulingReadModel`: SQL a mano, cruza
 * `evaluations` (propia de este contexto) con `student_profiles`,
 * `memberships` y `users` (de `people` y tenancy) y devuelve estructuras
 * planas. El aislamiento lo sigue dando RLS, aunque la consulta toque tablas
 * de otro contexto.
 */
@Injectable()
export class DrizzleAssessmentReadModel implements AssessmentReadModel {
  constructor(
    private readonly drizzle: DrizzleService,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async studentsWithoutRecentEvaluation(params: {
    weeks: number;
    now: Date;
  }): Promise<StudentWithoutEvaluation[]> {
    return this.uow.read(async () => this.query(params));
  }

  private async query(params: { weeks: number; now: Date }): Promise<StudentWithoutEvaluation[]> {
    const cutoff = new Date(params.now.getTime() - params.weeks * WEEK_MS);

    const rows = await this.drizzle.db.execute<{
      student_id: string;
      name: string;
      joined_at: Date;
      last_evaluation_at: Date | null;
    }>(sql`
      WITH last_evaluation AS (
        SELECT student_profile_id, MAX(created_at) AS last_at
        FROM evaluations
        GROUP BY student_profile_id
      )
      SELECT
        sp.id        AS student_id,
        u.name       AS name,
        sp.joined_at AS joined_at,
        le.last_at   AS last_evaluation_at
      FROM student_profiles sp
      JOIN memberships m ON m.id = sp.membership_id
      JOIN users u       ON u.id = m.user_id
      LEFT JOIN last_evaluation le ON le.student_profile_id = sp.id
      WHERE sp.status = 'active'
        AND (le.last_at IS NULL OR le.last_at < ${cutoff.toISOString()}::timestamptz)
      ORDER BY u.name
    `);

    return rows.map((r) => ({
      studentId: r.student_id,
      name: r.name,
      joinedAt: new Date(r.joined_at).toISOString(),
      weeksSinceLastEvaluation: r.last_evaluation_at
        ? Math.floor((params.now.getTime() - new Date(r.last_evaluation_at).getTime()) / WEEK_MS)
        : null,
    }));
  }

  /**
   * Bandeja del profesor (tarea 12 de la ola 2, paso 5): intentos en
   * `submitted` (sin corrección automática disponible) o `ai_graded` (la IA
   * ya propuso, falta la firma), el más antiguo primero — el mismo orden que
   * `NotifyOverdueAttemptsJob` (tarea 7) usa para avisar de lo que lleva
   * tiempo esperando.
   */
  async pendingValidation(params: { limit: number }): Promise<PendingAttemptEntry[]> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db.execute<{
        attempt_id: string;
        exercise_id: string;
        exercise_type: string;
        skill: string;
        prompt: Record<string, unknown>;
        response: Record<string, unknown>;
        max_score: number;
        student_profile_id: string;
        student_name: string;
        status: string;
        attempt_number: number;
        ai_score: number | string | null;
        ai_feedback: string | null;
        submitted_at: Date;
      }>(sql`
        SELECT
          a.id                AS attempt_id,
          a.exercise_id       AS exercise_id,
          ex.type             AS exercise_type,
          ex.skill            AS skill,
          ex.prompt           AS prompt,
          a.response          AS response,
          ex.max_score        AS max_score,
          a.student_profile_id AS student_profile_id,
          u.name              AS student_name,
          a.status            AS status,
          a.attempt_number    AS attempt_number,
          a.ai_score          AS ai_score,
          a.ai_feedback       AS ai_feedback,
          a.submitted_at      AS submitted_at
        FROM attempts a
        JOIN exercises ex ON ex.id = a.exercise_id
        JOIN student_profiles sp ON sp.id = a.student_profile_id
        JOIN memberships m ON m.id = sp.membership_id
        JOIN users u ON u.id = m.user_id
        WHERE a.status IN ('submitted', 'ai_graded')
        ORDER BY a.submitted_at ASC
        LIMIT ${params.limit}
      `);

      return rows.map((row) => ({
        attemptId: row.attempt_id,
        exerciseId: row.exercise_id,
        exerciseType: row.exercise_type,
        skill: row.skill,
        prompt: row.prompt,
        response: row.response,
        maxScore: row.max_score,
        studentProfileId: row.student_profile_id,
        studentName: row.student_name,
        status: row.status,
        attemptNumber: row.attempt_number,
        aiScore: row.ai_score === null ? null : Number(row.ai_score),
        aiFeedback: row.ai_feedback,
        submittedAt: new Date(row.submitted_at).toISOString(),
      }));
    });
  }
}
