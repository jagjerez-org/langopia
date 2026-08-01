import type { RespondentKind } from "../model/survey-types.js";

export type SurveyRespondent = {
  membershipId: string;
  respondentKind: RespondentKind;
};

export interface SurveyDispatchPort {
  attendedRespondents(sessionId: string): Promise<SurveyRespondent[]>;
  canRespondToSession(params: {
    respondentMembershipId: string;
    respondentKind: RespondentKind;
    sessionId: string;
  }): Promise<boolean>;
  sendPostSessionSurvey(params: {
    surveyId: string;
    surveyCode: string;
    sessionId: string;
    respondentMembershipId: string;
    respondentKind: RespondentKind;
  }): Promise<void>;
}

export const SURVEY_DISPATCH_PORT = Symbol("SurveyDispatchPort");

