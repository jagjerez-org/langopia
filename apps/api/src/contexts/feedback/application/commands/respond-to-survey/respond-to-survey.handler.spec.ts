import { describe, expect, it, vi } from "vitest";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import type { TenantContext } from "../../../../shared/domain/ports/tenant-context.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { MembershipId, SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import { SurveyAccessDeniedError } from "../../../domain/errors/feedback.errors.js";
import type { SurveyDispatchPort } from "../../../domain/ports/survey-dispatch.port.js";
import type { SurveyRepository } from "../../../domain/ports/survey.repository.port.js";
import { ResponseId, SessionId, SurveyId } from "../../../domain/model/identifiers.js";
import { Score } from "../../../domain/model/score.vo.js";
import { Survey } from "../../../domain/model/survey.aggregate.js";
import { RespondToSurveyCommand } from "./respond-to-survey.command.js";
import { RespondToSurveyHandler } from "./respond-to-survey.handler.js";

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const SURVEY_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "33333333-3333-4333-8333-333333333333";
const MEMBERSHIP_ID = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-09-01T10:00:00Z");

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeClock(): Clock {
  return { now: () => NOW };
}

function fakeIds(): IdGenerator {
  return { generate: () => "55555555-5555-4555-8555-555555555555" };
}

function fakeTenant(roles: readonly string[] = ["student"]): TenantContext {
  return {
    schoolId: () => SCHOOL_ID,
    membershipId: () => MEMBERSHIP_ID,
    roles: () => roles,
    has: (role) => roles.includes(role),
  };
}

function survey(): Survey {
  return Survey.create({
    id: SurveyId.of(SURVEY_ID),
    schoolId: SchoolId.of(SCHOOL_ID),
    kind: "post_session",
    code: "csat-clase",
    name: "¿Qué tal la clase?",
    audience: "student",
    autoSendAfterSession: true,
    now: NOW,
  });
}

describe("RespondToSurveyHandler", () => {
  it("guarda una respuesta del alumno si asistió a la clase", async () => {
    const aggregate = survey();
    const surveys: SurveyRepository = {
      findActiveAutoPostSession: vi.fn(),
      findByIdForRespondent: vi.fn(async () => aggregate),
      save: vi.fn(async () => undefined),
    };
    const dispatch: SurveyDispatchPort = {
      attendedRespondents: vi.fn(),
      sendPostSessionSurvey: vi.fn(),
      canRespondToSession: vi.fn(async () => true),
    };

    const handler = new RespondToSurveyHandler(surveys, dispatch, fakeUow(), fakeTenant(), fakeClock(), fakeIds());
    const result = await handler.execute(
      new RespondToSurveyCommand({
        surveyId: SURVEY_ID,
        score: 5,
        comment: "Muy clara",
        sessionId: SESSION_ID,
      }),
    );

    expect(result.replaced).toBe(false);
    expect(surveys.save).toHaveBeenCalledWith(aggregate);
    expect(aggregate.responses[0]?.respondentMembershipId.value).toBe(MEMBERSHIP_ID);
    expect(aggregate.responses[0]?.sessionId?.value).toBe(SESSION_ID);
  });

  it("rechaza una post-clase si el alumno no asistió", async () => {
    const surveys: SurveyRepository = {
      findActiveAutoPostSession: vi.fn(),
      findByIdForRespondent: vi.fn(async () => survey()),
      save: vi.fn(),
    };
    const dispatch: SurveyDispatchPort = {
      attendedRespondents: vi.fn(),
      sendPostSessionSurvey: vi.fn(),
      canRespondToSession: vi.fn(async () => false),
    };

    const handler = new RespondToSurveyHandler(surveys, dispatch, fakeUow(), fakeTenant(), fakeClock(), fakeIds());

    await expect(
      handler.execute(
        new RespondToSurveyCommand({
          surveyId: SURVEY_ID,
          score: 4,
          comment: null,
          sessionId: SESSION_ID,
        }),
      ),
    ).rejects.toThrow(SurveyAccessDeniedError);
  });

  it("reemplaza una respuesta previa del mismo alumno y sesión", async () => {
    const aggregate = survey();
    aggregate.respond({
      responseId: ResponseId.of("66666666-6666-4666-8666-666666666666"),
      respondentMembershipId: MembershipId.of(MEMBERSHIP_ID),
      respondentKind: "student",
      score: Score.forSurveyKind("post_session", 2),
      comment: "Inicial",
      sessionId: SessionId.of(SESSION_ID),
      teacherProfileId: null,
      submittedAt: NOW,
    });
    const surveys: SurveyRepository = {
      findActiveAutoPostSession: vi.fn(),
      findByIdForRespondent: vi.fn(async () => aggregate),
      save: vi.fn(async () => undefined),
    };
    const dispatch: SurveyDispatchPort = {
      attendedRespondents: vi.fn(),
      sendPostSessionSurvey: vi.fn(),
      canRespondToSession: vi.fn(async () => true),
    };

    const handler = new RespondToSurveyHandler(surveys, dispatch, fakeUow(), fakeTenant(), fakeClock(), fakeIds());
    const result = await handler.execute(
      new RespondToSurveyCommand({
        surveyId: SURVEY_ID,
        score: 5,
        comment: "Corregida",
        sessionId: SESSION_ID,
      }),
    );

    expect(result.replaced).toBe(true);
    expect(aggregate.responses).toHaveLength(1);
    expect(aggregate.responses[0]?.score.value).toBe(5);
  });
});
