import type { PinoLogger } from "nestjs-pino";
import { describe, expect, it, vi } from "vitest";
import { ClassSessionCompleted } from "../../../scheduling/domain/events/class-session.events.js";
import type { UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import type { SurveyDispatchPort } from "../../domain/ports/survey-dispatch.port.js";
import type { SurveyRepository } from "../../domain/ports/survey.repository.port.js";
import type { SurveyRespondent } from "../../domain/ports/survey-dispatch.port.js";
import { OnFeedbackClassSessionCompleted } from "./on-class-session-completed.handler.js";

const SURVEY_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "33333333-3333-4333-8333-333333333333";
const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "44444444-4444-4444-8444-444444444444";
const TEACHER_ID = "55555555-5555-4555-8555-555555555555";

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeLogger(): PinoLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as PinoLogger;
}

function completed(): ClassSessionCompleted {
  return new ClassSessionCompleted({
    sessionId: SESSION_ID,
    schoolId: SCHOOL_ID,
    groupId: GROUP_ID,
    teacherId: TEACHER_ID,
    actualMinutes: 60,
    roomProvider: "livekit",
    transcriptionCapable: true,
  });
}

describe("OnFeedbackClassSessionCompleted", () => {
  it("envía la encuesta post-clase solo a asistentes", async () => {
    const respondents: SurveyRespondent[] = [
      { membershipId: "a", respondentKind: "student" },
      { membershipId: "b", respondentKind: "student" },
    ];
    const surveys: SurveyRepository = {
      findActiveAutoPostSession: vi.fn(async () => ({ id: SURVEY_ID, code: "csat-clase" })),
      findByIdForRespondent: vi.fn(),
      save: vi.fn(),
    };
    const dispatch: SurveyDispatchPort = {
      attendedRespondents: vi.fn(async () => respondents),
      sendPostSessionSurvey: vi.fn(async () => undefined),
      canRespondToSession: vi.fn(),
    };

    const handler = new OnFeedbackClassSessionCompleted(surveys, dispatch, fakeUow(), fakeLogger());
    await handler.handle(completed());

    expect(dispatch.attendedRespondents).toHaveBeenCalledWith(SESSION_ID);
    expect(dispatch.sendPostSessionSurvey).toHaveBeenCalledTimes(2);
    expect(dispatch.sendPostSessionSurvey).toHaveBeenCalledWith({
      surveyId: SURVEY_ID,
      surveyCode: "csat-clase",
      sessionId: SESSION_ID,
      respondentMembershipId: "a",
      respondentKind: "student",
    });
  });

  it("no envía nada si no hay asistentes", async () => {
    const surveys: SurveyRepository = {
      findActiveAutoPostSession: vi.fn(async () => ({ id: SURVEY_ID, code: "csat-clase" })),
      findByIdForRespondent: vi.fn(),
      save: vi.fn(),
    };
    const dispatch: SurveyDispatchPort = {
      attendedRespondents: vi.fn(async () => []),
      sendPostSessionSurvey: vi.fn(async () => undefined),
      canRespondToSession: vi.fn(),
    };

    const handler = new OnFeedbackClassSessionCompleted(surveys, dispatch, fakeUow(), fakeLogger());
    await handler.handle(completed());

    expect(dispatch.sendPostSessionSurvey).not.toHaveBeenCalled();
  });
});
