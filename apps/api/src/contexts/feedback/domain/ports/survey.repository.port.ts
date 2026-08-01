import type { Survey } from "../model/survey.aggregate.js";
import type { SessionId, SurveyId } from "../model/identifiers.js";
import type { MembershipId } from "../../../shared/domain/primitives/school-id.js";

export type ActivePostSessionSurvey = { id: string; code: string };

export interface SurveyRepository {
  findActiveAutoPostSession(): Promise<ActivePostSessionSurvey | null>;
  findByIdForRespondent(params: {
    surveyId: SurveyId;
    respondentMembershipId: MembershipId;
    sessionId: SessionId | null;
  }): Promise<Survey | null>;
  save(survey: Survey): Promise<void>;
}

export const SURVEY_REPOSITORY = Symbol("SurveyRepository");

