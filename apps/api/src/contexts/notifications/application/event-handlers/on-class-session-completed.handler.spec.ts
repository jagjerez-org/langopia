import { describe, expect, it } from "vitest";
import { ClassSessionCompleted } from "../../../scheduling/domain/events/class-session.events.js";
import type { UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import type { ClassDirectoryPort } from "../../domain/ports/class-directory.port.js";
import type { RecipientCandidate } from "../../domain/model/recipient.js";
import type { MailerPort } from "../../domain/ports/mailer.port.js";
import type {
  PeopleDirectoryPort,
  StudentRecipientContext,
} from "../../domain/ports/people-directory.port.js";
import { OnClassSessionCompleted } from "./on-class-session-completed.handler.js";

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "33333333-3333-4333-8333-333333333333";
const ATTENDED = "44444444-4444-4444-8444-444444444444";
const ABSENT = "55555555-5555-4555-8555-555555555555";

function candidate(email: string): RecipientCandidate {
  return { membershipId: email, email, name: email, membershipLocale: "gl-ES", userLocale: "es-ES" };
}

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeLogger() {
  return { info: () => undefined, warn: () => undefined, error: () => undefined };
}

function buildEvent(): ClassSessionCompleted {
  return new ClassSessionCompleted({
    sessionId: SESSION_ID,
    schoolId: SCHOOL_ID,
    groupId: GROUP_ID,
    teacherId: "66666666-6666-4666-8666-666666666666",
    actualMinutes: 55,
    roomProvider: "livekit",
    transcriptionCapable: true,
  });
}

describe("OnClassSessionCompleted", () => {
  it("solo envía la encuesta a quien asistió, no a toda la matrícula del grupo", async () => {
    const sent: string[] = [];
    const classes: ClassDirectoryPort = {
      activeStudentIds: async () => [ATTENDED, ABSENT],
      groupIdForSession: async () => GROUP_ID,
      attendedStudentIds: async () => [ATTENDED],
      scheduledSessionsStartingBetween: async () => [],
    };
    const people: PeopleDirectoryPort = {
      findStudentRecipientContext: async (studentId): Promise<StudentRecipientContext> => ({
        isMinor: false,
        student: candidate(`${studentId}@example.com`),
        guardians: [],
      }),
      findMembershipRecipient: async () => null,
    };
    const mailer: MailerPort = {
      send: async (params) => {
        sent.push(params.to);
      },
    };

    const handler = new OnClassSessionCompleted(classes, people, mailer, fakeUow(), fakeLogger() as never);
    await handler.handle(buildEvent());

    expect(sent).toEqual([`${ATTENDED}@example.com`]);
  });

  it("sin asistentes registrados, no envía nada ni falla", async () => {
    const classes: ClassDirectoryPort = {
      activeStudentIds: async () => [],
      groupIdForSession: async () => GROUP_ID,
      attendedStudentIds: async () => [],
      scheduledSessionsStartingBetween: async () => [],
    };
    let called = false;
    const people: PeopleDirectoryPort = {
      findStudentRecipientContext: async () => {
        called = true;
        return null;
      },
      findMembershipRecipient: async () => null,
    };
    const mailer: MailerPort = { send: async () => undefined };

    const handler = new OnClassSessionCompleted(classes, people, mailer, fakeUow(), fakeLogger() as never);
    await handler.handle(buildEvent());

    expect(called).toBe(false);
  });
});
