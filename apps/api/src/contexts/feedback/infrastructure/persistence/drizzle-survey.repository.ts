import { Injectable } from "@nestjs/common";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import * as schema from "@langopia/db/schema";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { SessionId, SurveyId } from "../../domain/model/identifiers.js";
import type { Survey } from "../../domain/model/survey.aggregate.js";
import type { MembershipId } from "../../../shared/domain/primitives/school-id.js";
import type {
  ActivePostSessionSurvey,
  SurveyRepository,
} from "../../domain/ports/survey.repository.port.js";
import { SurveyMapper } from "./survey.mapper.js";

@Injectable()
export class DrizzleSurveyRepository implements SurveyRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async findActiveAutoPostSession(): Promise<ActivePostSessionSurvey | null> {
    const rows = await this.drizzle.db
      .select({ id: schema.surveys.id, code: schema.surveys.code })
      .from(schema.surveys)
      .where(
        and(
          eq(schema.surveys.kind, "post_session"),
          eq(schema.surveys.audience, "student"),
          eq(schema.surveys.autoSendAfterSession, true),
          eq(schema.surveys.isActive, true),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async findByIdForRespondent(params: {
    surveyId: SurveyId;
    respondentMembershipId: MembershipId;
    sessionId: SessionId | null;
  }): Promise<Survey | null> {
    const surveyRows = await this.drizzle.db
      .select()
      .from(schema.surveys)
      .where(eq(schema.surveys.id, params.surveyId.value))
      .limit(1);
    const row = surveyRows[0];
    if (!row) return null;

    const responseRows = await this.drizzle.db
      .select()
      .from(schema.surveyResponses)
      .where(
        and(
          eq(schema.surveyResponses.surveyId, params.surveyId.value),
          eq(schema.surveyResponses.respondentMembershipId, params.respondentMembershipId.value),
          params.sessionId
            ? eq(schema.surveyResponses.sessionId, params.sessionId.value)
            : isNull(schema.surveyResponses.sessionId),
        ),
      )
      .orderBy(desc(schema.surveyResponses.submittedAt))
      .limit(1);

    return SurveyMapper.toDomain(row, responseRows);
  }

  async save(survey: Survey): Promise<void> {
    await this.drizzle.db
      .insert(schema.surveys)
      .values({
        id: survey.id.value,
        schoolId: survey.schoolId.value,
        kind: survey.kind,
        code: survey.code,
        name: survey.name,
        audience: survey.audience,
        autoSendAfterSession: survey.autoSendAfterSession,
        isActive: survey.isActive,
        createdAt: survey.createdAt,
      })
      .onConflictDoUpdate({
        target: schema.surveys.id,
        set: {
          name: survey.name,
          autoSendAfterSession: survey.autoSendAfterSession,
          isActive: survey.isActive,
        },
      });

    for (const response of survey.responses) {
      await this.drizzle.db.execute(sql`
        INSERT INTO survey_responses (
          id,
          school_id,
          survey_id,
          respondent_membership_id,
          respondent_kind,
          session_id,
          teacher_profile_id,
          score,
          comment,
          submitted_at
        )
        VALUES (
          ${response.id.value},
          ${survey.schoolId.value},
          ${survey.id.value},
          ${response.respondentMembershipId.value},
          ${response.respondentKind},
          ${response.sessionId?.value ?? null},
          ${response.teacherProfileId?.value ?? null},
          ${response.score.value},
          ${response.comment},
          ${response.submittedAt.toISOString()}::timestamptz
        )
        ON CONFLICT (
          survey_id,
          respondent_membership_id,
          (COALESCE(session_id, '00000000-0000-0000-0000-000000000000'::uuid))
        )
        DO UPDATE SET
          score = EXCLUDED.score,
          comment = EXCLUDED.comment,
          submitted_at = EXCLUDED.submitted_at
      `);
    }
  }
}
