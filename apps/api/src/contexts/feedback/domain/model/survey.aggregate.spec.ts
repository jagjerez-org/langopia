import { describe, expect, it } from "vitest";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import {
  InactiveSurveyError,
  SurveyAudienceMismatchError,
  SurveySessionRequiredError,
} from "../errors/feedback.errors.js";
import { ResponseId, SessionId, SurveyId, TeacherProfileId } from "./identifiers.js";
import { Score } from "./score.vo.js";
import { Survey } from "./survey.aggregate.js";

const SCHOOL_ID = SchoolId.of("11111111-1111-4111-8111-111111111111");
const SURVEY_ID = SurveyId.of("22222222-2222-4222-8222-222222222222");
const RESPONSE_ID = ResponseId.of("33333333-3333-4333-8333-333333333333");
const REPLACEMENT_ID = ResponseId.of("44444444-4444-4444-8444-444444444444");
const STUDENT = MembershipId.of("55555555-5555-4555-8555-555555555555");
const SESSION = SessionId.of("66666666-6666-4666-8666-666666666666");
const TEACHER = TeacherProfileId.of("77777777-7777-4777-8777-777777777777");
const NOW = new Date("2026-09-01T10:00:00Z");

function postSessionSurvey(): Survey {
  return Survey.create({
    id: SURVEY_ID,
    schoolId: SCHOOL_ID,
    kind: "post_session",
    code: "csat-clase",
    name: "¿Qué tal la clase?",
    audience: "student",
    autoSendAfterSession: true,
    now: NOW,
  });
}

describe("Survey", () => {
  it("permite activar y cerrar una encuesta", () => {
    const survey = postSessionSurvey();

    survey.close();
    expect(survey.isActive).toBe(false);

    survey.activate();
    expect(survey.isActive).toBe(true);
  });

  it("rechaza respuestas si está cerrada", () => {
    const survey = postSessionSurvey();
    survey.close();

    expect(() =>
      survey.respond({
        responseId: RESPONSE_ID,
        respondentMembershipId: STUDENT,
        respondentKind: "student",
        score: Score.forSurveyKind("post_session", 4),
        comment: null,
        sessionId: SESSION,
        teacherProfileId: TEACHER,
        submittedAt: NOW,
      }),
    ).toThrow(InactiveSurveyError);
  });

  it("rechaza una audiencia distinta a la encuesta", () => {
    const survey = postSessionSurvey();

    expect(() =>
      survey.respond({
        responseId: RESPONSE_ID,
        respondentMembershipId: STUDENT,
        respondentKind: "guardian",
        score: Score.forSurveyKind("post_session", 4),
        comment: null,
        sessionId: SESSION,
        teacherProfileId: TEACHER,
        submittedAt: NOW,
      }),
    ).toThrow(SurveyAudienceMismatchError);
  });

  it("exige sesión para encuesta post-clase", () => {
    const survey = postSessionSurvey();

    expect(() =>
      survey.respond({
        responseId: RESPONSE_ID,
        respondentMembershipId: STUDENT,
        respondentKind: "student",
        score: Score.forSurveyKind("post_session", 4),
        comment: null,
        sessionId: null,
        teacherProfileId: TEACHER,
        submittedAt: NOW,
      }),
    ).toThrow(SurveySessionRequiredError);
  });

  it("sustituye la respuesta del mismo alumno y periodo", () => {
    const survey = postSessionSurvey();

    const first = survey.respond({
      responseId: RESPONSE_ID,
      respondentMembershipId: STUDENT,
      respondentKind: "student",
      score: Score.forSurveyKind("post_session", 2),
      comment: "Floja",
      sessionId: SESSION,
      teacherProfileId: TEACHER,
      submittedAt: NOW,
    });
    const replacement = survey.respond({
      responseId: REPLACEMENT_ID,
      respondentMembershipId: STUDENT,
      respondentKind: "student",
      score: Score.forSurveyKind("post_session", 5),
      comment: "Corregido",
      sessionId: SESSION,
      teacherProfileId: TEACHER,
      submittedAt: new Date("2026-09-01T10:05:00Z"),
    });

    expect(first.replaced).toBe(false);
    expect(replacement.replaced).toBe(true);
    expect(survey.responses).toHaveLength(1);
    expect(survey.responses[0]?.id.value).toBe(RESPONSE_ID.value);
    expect(survey.responses[0]?.score.value).toBe(5);
    expect(survey.responses[0]?.comment).toBe("Corregido");
  });
});
