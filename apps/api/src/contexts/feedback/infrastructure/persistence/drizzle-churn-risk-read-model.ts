import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from "../../../shared/domain/ports/unit-of-work.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type {
  ChurnRiskReadModel,
  StudentChurnRiskSignals,
} from "../../application/ports/churn-risk-read-model.port.js";

@Injectable()
export class DrizzleChurnRiskReadModel implements ChurnRiskReadModel {
  constructor(
    private readonly drizzle: DrizzleService,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async signals(params: {
    attendanceFrom: Date;
    attendanceTo: Date;
    recentReviewFrom: Date;
    now: Date;
  }): Promise<StudentChurnRiskSignals[]> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db.execute<{
        student_id: string;
        name: string;
        attendance_total: number | null;
        attendance_attended: number | null;
        consecutive_absences: number | null;
        last_progress_rating: number | null;
        last_evaluation_at: Date | null;
        recent_negative_review_rating: number | null;
        has_past_due_invoice: boolean;
        latest_nps_score: number | null;
      }>(sql`
        WITH active_students AS (
          SELECT sp.id, sp.membership_id, u.name
          FROM student_profiles sp
          JOIN memberships m ON m.id = sp.membership_id
          JOIN users u       ON u.id = m.user_id
          WHERE sp.status = 'active'
        ),
        recent_attendance AS (
          SELECT
            a.student_profile_id,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE a.status IN ('present', 'late'))::int AS attended
          FROM attendance a
          JOIN sessions s ON s.id = a.session_id
          WHERE s.scheduled_start >= ${params.attendanceFrom.toISOString()}::timestamptz
            AND s.scheduled_start <  ${params.attendanceTo.toISOString()}::timestamptz
            AND s.status = 'completed'
          GROUP BY a.student_profile_id
        ),
        attendance_ranked AS (
          SELECT
            a.student_profile_id,
            a.status,
            row_number() OVER (
              PARTITION BY a.student_profile_id
              ORDER BY s.scheduled_start DESC, a.id DESC
            ) AS rn
          FROM attendance a
          JOIN sessions s ON s.id = a.session_id
          WHERE s.scheduled_start < ${params.attendanceTo.toISOString()}::timestamptz
            AND s.status = 'completed'
        ),
        attendance_with_boundary AS (
          SELECT
            student_profile_id,
            status,
            rn,
            MIN(rn) FILTER (WHERE status <> 'absent') OVER (
              PARTITION BY student_profile_id
            ) AS first_non_absent_rn
          FROM attendance_ranked
        ),
        absence_streak AS (
          SELECT
            student_profile_id,
            COUNT(*) FILTER (
              WHERE status = 'absent'
                AND (first_non_absent_rn IS NULL OR rn < first_non_absent_rn)
            )::int AS consecutive_absences
          FROM attendance_with_boundary
          GROUP BY student_profile_id
        ),
        latest_evaluation AS (
          SELECT DISTINCT ON (student_profile_id)
            student_profile_id,
            progress_rating,
            created_at
          FROM evaluations
          ORDER BY student_profile_id, created_at DESC
        ),
        recent_reviews AS (
          SELECT
            author_membership_id,
            MIN(rating)::int AS rating
          FROM reviews
          WHERE created_at >= ${params.recentReviewFrom.toISOString()}::timestamptz
          GROUP BY author_membership_id
        ),
        past_due_invoices AS (
          SELECT student_profile_id, TRUE AS has_past_due_invoice
          FROM invoices
          WHERE status = 'past_due'
            AND student_profile_id IS NOT NULL
          GROUP BY student_profile_id
        ),
        latest_nps AS (
          SELECT DISTINCT ON (sr.respondent_membership_id)
            sr.respondent_membership_id,
            sr.score
          FROM survey_responses sr
          JOIN surveys s ON s.id = sr.survey_id
          WHERE s.kind = 'nps'
            AND sr.respondent_kind = 'student'
          ORDER BY sr.respondent_membership_id, sr.submitted_at DESC
        )
        SELECT
          ast.id AS student_id,
          ast.name,
          ra.total AS attendance_total,
          ra.attended AS attendance_attended,
          COALESCE(abs.consecutive_absences, 0)::int AS consecutive_absences,
          le.progress_rating::int AS last_progress_rating,
          le.created_at AS last_evaluation_at,
          rr.rating AS recent_negative_review_rating,
          COALESCE(pdi.has_past_due_invoice, FALSE) AS has_past_due_invoice,
          ln.score::int AS latest_nps_score
        FROM active_students ast
        LEFT JOIN recent_attendance ra ON ra.student_profile_id = ast.id
        LEFT JOIN absence_streak abs   ON abs.student_profile_id = ast.id
        LEFT JOIN latest_evaluation le ON le.student_profile_id = ast.id
        LEFT JOIN recent_reviews rr    ON rr.author_membership_id = ast.membership_id
        LEFT JOIN past_due_invoices pdi ON pdi.student_profile_id = ast.id
        LEFT JOIN latest_nps ln        ON ln.respondent_membership_id = ast.membership_id
        ORDER BY ast.name
      `);

      return rows.map((row) => {
        const total = Number(row.attendance_total ?? 0);
        const attended = Number(row.attendance_attended ?? 0);
        const lastEvaluationAt = row.last_evaluation_at ? new Date(row.last_evaluation_at) : null;

        return {
          studentId: row.student_id,
          name: row.name,
          attendanceRateLast4Weeks:
            total > 0 ? Math.round((attended / total) * 1000) / 1000 : null,
          consecutiveAbsences: Number(row.consecutive_absences ?? 0),
          weeksWithoutEvaluation: lastEvaluationAt
            ? Math.floor((params.now.getTime() - lastEvaluationAt.getTime()) / (7 * 24 * 3_600_000))
            : null,
          lastProgressRating:
            row.last_progress_rating === null ? null : Number(row.last_progress_rating),
          recentNegativeReviewRating:
            row.recent_negative_review_rating === null
              ? null
              : Number(row.recent_negative_review_rating),
          hasPastDueInvoice: row.has_past_due_invoice,
          latestNpsScore: row.latest_nps_score === null ? null : Number(row.latest_nps_score),
        };
      });
    });
  }
}
