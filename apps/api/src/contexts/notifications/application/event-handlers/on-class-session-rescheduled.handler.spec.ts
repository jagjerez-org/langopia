import { describe, expect, it } from "vitest";
import { ClassSessionRescheduled } from "../../../scheduling/domain/events/class-session.events.js";
import type { UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import type { ClassDirectoryPort } from "../../domain/ports/class-directory.port.js";
import type { RecipientCandidate } from "../../domain/model/recipient.js";
import type { MailerPort } from "../../domain/ports/mailer.port.js";
import type {
  PeopleDirectoryPort,
  StudentRecipientContext,
} from "../../domain/ports/people-directory.port.js";
import { OnClassSessionRescheduled } from "./on-class-session-rescheduled.handler.js";

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "22222222-2222-4222-8222-222222222222";
const OLD_SESSION_ID = "33333333-3333-4333-8333-333333333333";
const NEW_SESSION_ID = "77777777-7777-4777-8777-777777777777";
const STUDENT_A = "44444444-4444-4444-8444-444444444444";

function candidate(email: string, locale: string): RecipientCandidate {
  return { membershipId: email, email, name: email, membershipLocale: locale, userLocale: "es-ES" };
}

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeLogger() {
  return { info: () => undefined, warn: () => undefined, error: () => undefined };
}

function buildEvent(): ClassSessionRescheduled {
  return new ClassSessionRescheduled({
    sessionId: OLD_SESSION_ID,
    schoolId: SCHOOL_ID,
    replacementSessionId: NEW_SESSION_ID,
    previousStart: new Date("2026-09-01T08:00:00Z"),
    newStart: new Date("2026-09-02T08:00:00Z"),
    reason: "el aula no está disponible",
  });
}

describe("OnClassSessionRescheduled", () => {
  it("busca el grupo por la sesión de SUSTITUCIÓN, no por la cerrada, y avisa a su matrícula activa", async () => {
    const sent: unknown[] = [];
    const groupLookups: string[] = [];
    const classes: ClassDirectoryPort = {
      activeStudentIds: async () => [STUDENT_A],
      groupIdForSession: async (sessionId) => {
        groupLookups.push(sessionId);
        return GROUP_ID;
      },
      attendedStudentIds: async () => [],
      scheduledSessionsStartingBetween: async () => [],
    };
    const people: PeopleDirectoryPort = {
      findStudentRecipientContext: async (): Promise<StudentRecipientContext> => ({
        isMinor: false,
        student: candidate("a@example.com", "en-GB"),
        guardians: [],
      }),
      findMembershipRecipient: async () => null,
    };
    const mailer: MailerPort = {
      send: async (params) => {
        sent.push(params);
      },
    };

    const handler = new OnClassSessionRescheduled(
      classes,
      people,
      mailer,
      fakeUow(),
      fakeLogger() as never,
    );
    await handler.handle(buildEvent());

    expect(groupLookups).toEqual([NEW_SESSION_ID]);
    expect(sent).toEqual([
      {
        to: "a@example.com",
        locale: "en-GB",
        template: "class_rescheduled",
        data: expect.objectContaining({ reason: "el aula no está disponible" }),
      },
    ]);
  });

  it("si la sesión de sustitución no tiene grupo (dato roto), no avisa a nadie ni falla", async () => {
    const classes: ClassDirectoryPort = {
      activeStudentIds: async () => [STUDENT_A],
      groupIdForSession: async () => null,
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

    const handler = new OnClassSessionRescheduled(
      classes,
      people,
      mailer,
      fakeUow(),
      fakeLogger() as never,
    );
    await handler.handle(buildEvent());

    expect(called).toBe(false);
  });
});
