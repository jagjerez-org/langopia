import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from "../../../shared/domain/ports/unit-of-work.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type {
  FeedbackReadModel,
  TeacherProductivitySignals,
  TeacherQualityRow,
} from "../../application/ports/feedback-read-model.port.js";

@Injectable()
export class DrizzleFeedbackReadModel implements FeedbackReadModel {
  constructor(
    private readonly drizzle: DrizzleService,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async npsScoresBetween(params: { from: Date; to: Date }): Promise<number[]> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db.execute<{ score: number }>(sql`
        SELECT sr.score::int AS score
        FROM survey_responses sr
        JOIN surveys s ON s.id = sr.survey_id
        WHERE s.kind = 'nps'
          AND sr.submitted_at >= ${params.from.toISOString()}::timestamptz
          AND sr.submitted_at <  ${params.to.toISOString()}::timestamptz
      `);
      return rows.map((row) => Number(row.score));
    });
  }

  async teacherQualityBetween(params: { from: Date; to: Date }): Promise<TeacherQualityRow[]> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db.execute<{
        teacher_profile_id: string;
        teacher_name: string;
        responses: number;
        average_csat: number | null;
        negative_reviews_pending: number;
      }>(sql`
        WITH csat AS (
          SELECT
            sr.teacher_profile_id,
            COUNT(sr.id)::int AS responses,
            ROUND(AVG(sr.score)::numeric, 2)::float AS average_csat
          FROM survey_responses sr
          JOIN surveys s ON s.id = sr.survey_id
          WHERE s.kind = 'post_session'
            AND sr.teacher_profile_id IS NOT NULL
            AND sr.submitted_at >= ${params.from.toISOString()}::timestamptz
            AND sr.submitted_at <  ${params.to.toISOString()}::timestamptz
          GROUP BY sr.teacher_profile_id
        ),
        negative_reviews AS (
          SELECT
            r.teacher_profile_id,
            COUNT(r.id)::int AS pending
          FROM reviews r
          WHERE r.teacher_profile_id IS NOT NULL
            AND r.rating <= 2
            AND r.acknowledged_at IS NULL
            AND r.created_at >= ${params.from.toISOString()}::timestamptz
            AND r.created_at <  ${params.to.toISOString()}::timestamptz
          GROUP BY r.teacher_profile_id
        )
        SELECT
          tp.id AS teacher_profile_id,
          u.name AS teacher_name,
          COALESCE(csat.responses, 0)::int AS responses,
          csat.average_csat,
          COALESCE(negative_reviews.pending, 0)::int AS negative_reviews_pending
        FROM teacher_profiles tp
        JOIN memberships m ON m.id = tp.membership_id
        JOIN users u       ON u.id = m.user_id
        LEFT JOIN csat ON csat.teacher_profile_id = tp.id
        LEFT JOIN negative_reviews ON negative_reviews.teacher_profile_id = tp.id
        WHERE tp.status = 'active'
        ORDER BY csat.average_csat ASC NULLS LAST, negative_reviews_pending DESC, u.name
      `);

      return rows.map((row) => ({
        teacherProfileId: row.teacher_profile_id,
        teacherName: row.teacher_name,
        responses: Number(row.responses),
        averageCsat: row.average_csat === null ? null : Number(row.average_csat),
        negativeReviewsPending: Number(row.negative_reviews_pending),
      }));
    });
  }

  async teacherProductivityBetween(params: {
    from: Date;
    to: Date;
    staleEvaluationFrom: Date;
    unsignedCorrectionBefore: Date;
  }): Promise<TeacherProductivitySignals[]> {
    return this.uow.read(async () => {
      const weeks = Math.max(
        (params.to.getTime() - params.from.getTime()) / (7 * 24 * 3_600_000),
        1 / 7,
      );

      const rows = await this.drizzle.db.execute<{
        teacher_profile_id: string;
        teacher_name: string;
        scheduled_minutes: number;
        contracted_hours_week: number;
        session_count: number;
        completed_sessions: number;
        late_started_sessions: number;
        students_without_evaluation: number;
        students_without_evaluation_names: string[] | null;
        csat_responses: number;
        average_csat: number | null;
        material_reviews: number;
        average_material_review: number | null;
        pending_negative_material_reviews: number;
        unsigned_corrections_older_than_7_days: number;
      }>(sql`
        WITH occupancy AS (
          SELECT
            tp.id AS teacher_profile_id,
            COALESCE(SUM(
              EXTRACT(EPOCH FROM (s.scheduled_end - s.scheduled_start)) / 60
            ) FILTER (
              WHERE s.status IN ('scheduled', 'in_progress', 'completed')
            ), 0)::float AS scheduled_minutes,
            COUNT(s.id) FILTER (
              WHERE s.status IN ('scheduled', 'in_progress', 'completed')
            )::int AS session_count,
            COUNT(s.id) FILTER (WHERE s.status = 'completed')::int AS completed_sessions,
            COUNT(s.id) FILTER (
              WHERE s.status = 'completed'
                AND s.actual_start > s.scheduled_start + interval '5 minutes'
            )::int AS late_started_sessions
          FROM teacher_profiles tp
          LEFT JOIN sessions s
            ON s.teacher_profile_id = tp.id
           AND s.scheduled_start >= ${params.from.toISOString()}::timestamptz
           AND s.scheduled_start <  ${params.to.toISOString()}::timestamptz
          WHERE tp.status = 'active'
          GROUP BY tp.id
        ),
        students_without_evaluation AS (
          SELECT
            g.teacher_profile_id,
            COUNT(DISTINCT sp.id)::int AS students_without_evaluation,
            ARRAY_AGG(DISTINCT u.name ORDER BY u.name) AS names
          FROM groups g
          JOIN enrollments e
            ON e.group_id = g.id
           AND e.status = 'active'
          JOIN student_profiles sp
            ON sp.id = e.student_profile_id
           AND sp.status = 'active'
          JOIN memberships m ON m.id = sp.membership_id
          JOIN users u       ON u.id = m.user_id
          WHERE g.teacher_profile_id IS NOT NULL
            AND g.status IN ('running', 'planned')
            AND NOT EXISTS (
              SELECT 1
              FROM evaluations ev
              WHERE ev.teacher_profile_id = g.teacher_profile_id
                AND ev.student_profile_id = sp.id
                AND ev.created_at >= ${params.staleEvaluationFrom.toISOString()}::timestamptz
            )
          GROUP BY g.teacher_profile_id
        ),
        csat AS (
          SELECT
            sr.teacher_profile_id,
            COUNT(sr.id)::int AS responses,
            ROUND(AVG(sr.score)::numeric, 2)::float AS average_csat
          FROM survey_responses sr
          JOIN surveys s ON s.id = sr.survey_id
          WHERE s.kind = 'post_session'
            AND sr.teacher_profile_id IS NOT NULL
            AND sr.submitted_at >= ${params.from.toISOString()}::timestamptz
            AND sr.submitted_at <  ${params.to.toISOString()}::timestamptz
          GROUP BY sr.teacher_profile_id
        ),
        material_reviews AS (
          SELECT
            attributed.teacher_profile_id,
            COUNT(DISTINCT attributed.review_id)::int AS material_reviews,
            ROUND(AVG(attributed.rating)::numeric, 2)::float AS average_material_review,
            COUNT(DISTINCT attributed.review_id) FILTER (
              WHERE attributed.rating <= 2 AND attributed.acknowledged_at IS NULL
            )::int AS pending_negative_material_reviews
          FROM (
            SELECT
              r.id AS review_id,
              r.rating,
              r.acknowledged_at,
              COALESCE(r.teacher_profile_id, rs.teacher_profile_id, g.teacher_profile_id) AS teacher_profile_id
            FROM reviews r
            LEFT JOIN sessions rs ON rs.id = r.session_id
            LEFT JOIN content_units cu ON cu.id = r.content_unit_id
            LEFT JOIN groups g
              ON g.course_id = cu.course_id
             AND g.status IN ('running', 'planned')
            WHERE r.subject = 'material'
              AND r.created_at >= ${params.from.toISOString()}::timestamptz
              AND r.created_at <  ${params.to.toISOString()}::timestamptz
          ) attributed
          WHERE attributed.teacher_profile_id IS NOT NULL
          GROUP BY attributed.teacher_profile_id
        ),
        unsigned_corrections AS (
          SELECT
            attributed.teacher_profile_id,
            COUNT(DISTINCT attributed.attempt_id)::int AS unsigned_corrections
          FROM (
            SELECT
              a.id AS attempt_id,
              COALESCE(s.teacher_profile_id, g.teacher_profile_id) AS teacher_profile_id
            FROM attempts a
            LEFT JOIN sessions s ON s.id = a.session_id
            JOIN exercises ex ON ex.id = a.exercise_id
            JOIN content_units cu ON cu.id = ex.content_unit_id
            LEFT JOIN groups g
              ON g.course_id = cu.course_id
             AND g.status IN ('running', 'planned')
            LEFT JOIN enrollments e
              ON e.group_id = g.id
             AND e.student_profile_id = a.student_profile_id
             AND e.status = 'active'
            WHERE a.status = 'ai_graded'
              AND a.submitted_at < ${params.unsignedCorrectionBefore.toISOString()}::timestamptz
              AND (s.teacher_profile_id IS NOT NULL OR e.id IS NOT NULL)
          ) attributed
          WHERE attributed.teacher_profile_id IS NOT NULL
          GROUP BY attributed.teacher_profile_id
        )
        SELECT
          tp.id AS teacher_profile_id,
          u.name AS teacher_name,
          COALESCE(o.scheduled_minutes, 0)::float AS scheduled_minutes,
          tp.contracted_hours_week::int AS contracted_hours_week,
          COALESCE(o.session_count, 0)::int AS session_count,
          COALESCE(o.completed_sessions, 0)::int AS completed_sessions,
          COALESCE(o.late_started_sessions, 0)::int AS late_started_sessions,
          COALESCE(swe.students_without_evaluation, 0)::int AS students_without_evaluation,
          COALESCE(swe.names, ARRAY[]::text[]) AS students_without_evaluation_names,
          COALESCE(csat.responses, 0)::int AS csat_responses,
          csat.average_csat,
          COALESCE(mr.material_reviews, 0)::int AS material_reviews,
          mr.average_material_review,
          COALESCE(mr.pending_negative_material_reviews, 0)::int AS pending_negative_material_reviews,
          COALESCE(uc.unsigned_corrections, 0)::int AS unsigned_corrections_older_than_7_days
        FROM teacher_profiles tp
        JOIN memberships m ON m.id = tp.membership_id
        JOIN users u       ON u.id = m.user_id
        LEFT JOIN occupancy o ON o.teacher_profile_id = tp.id
        LEFT JOIN students_without_evaluation swe ON swe.teacher_profile_id = tp.id
        LEFT JOIN csat ON csat.teacher_profile_id = tp.id
        LEFT JOIN material_reviews mr ON mr.teacher_profile_id = tp.id
        LEFT JOIN unsigned_corrections uc ON uc.teacher_profile_id = tp.id
        WHERE tp.status = 'active'
        ORDER BY u.name
      `);

      return rows.map((row) => {
        const scheduledHours = Number(row.scheduled_minutes) / 60;
        const contractedHours = Number(row.contracted_hours_week) * weeks;
        return {
          teacherProfileId: row.teacher_profile_id,
          teacherName: row.teacher_name,
          scheduledHours: Math.round(scheduledHours * 100) / 100,
          contractedHours: Math.round(contractedHours * 100) / 100,
          occupancyRate:
            contractedHours > 0
              ? Math.round((scheduledHours / contractedHours) * 1000) / 1000
              : 0,
          sessionCount: Number(row.session_count),
          studentsWithoutEvaluation: Number(row.students_without_evaluation),
          studentsWithoutEvaluationNames: row.students_without_evaluation_names ?? [],
          averageCsat: row.average_csat === null ? null : Number(row.average_csat),
          csatResponses: Number(row.csat_responses),
          materialReviews: Number(row.material_reviews),
          averageMaterialReview:
            row.average_material_review === null ? null : Number(row.average_material_review),
          pendingNegativeMaterialReviews: Number(row.pending_negative_material_reviews),
          lateStartedSessions: Number(row.late_started_sessions),
          completedSessions: Number(row.completed_sessions),
          unsignedCorrectionsOlderThan7Days: Number(
            row.unsigned_corrections_older_than_7_days,
          ),
        };
      });
    });
  }
}
