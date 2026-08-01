import * as schema from "@langopia/db/schema";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { ResponseId, SessionId, SurveyId, TeacherProfileId } from "../../domain/model/identifiers.js";
import { Score } from "../../domain/model/score.vo.js";
import { SurveyResponse } from "../../domain/model/survey-response.entity.js";
import { Survey } from "../../domain/model/survey.aggregate.js";
import type { RespondentKind, SurveyKind } from "../../domain/model/survey-types.js";

type SurveyRow = typeof schema.surveys.$inferSelect;
type ResponseRow = typeof schema.surveyResponses.$inferSelect;

export class SurveyMapper {
  static toDomain(row: SurveyRow, responseRows: ResponseRow[]): Survey {
    return Survey.rehydrate({
      id: SurveyId.of(row.id),
      schoolId: SchoolId.of(row.schoolId),
      kind: row.kind as SurveyKind,
      code: row.code,
      name: row.name,
      audience: row.audience as RespondentKind,
      autoSendAfterSession: row.autoSendAfterSession,
      isActive: row.isActive,
      createdAt: row.createdAt,
      responses: responseRows.map((response) =>
        SurveyResponse.create({
          id: ResponseId.of(response.id),
          respondentMembershipId: MembershipId.of(response.respondentMembershipId),
          respondentKind: response.respondentKind as RespondentKind,
          score: Score.forSurveyKind(row.kind as SurveyKind, response.score),
          comment: response.comment,
          sessionId: response.sessionId ? SessionId.of(response.sessionId) : null,
          teacherProfileId: response.teacherProfileId
            ? TeacherProfileId.of(response.teacherProfileId)
            : null,
          submittedAt: response.submittedAt,
        }),
      ),
    });
  }
}

