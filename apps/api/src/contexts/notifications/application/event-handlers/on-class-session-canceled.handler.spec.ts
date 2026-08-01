import { describe, expect, it } from "vitest";
import { ClassSessionCanceled } from "../../../scheduling/domain/events/class-session.events.js";
import type { UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import type { ClassDirectoryPort } from "../../domain/ports/class-directory.port.js";
import type { RecipientCandidate } from "../../domain/model/recipient.js";
import type { MailerPort } from "../../domain/ports/mailer.port.js";
import type {
  PeopleDirectoryPort,
  StudentRecipientContext,
} from "../../domain/ports/people-directory.port.js";
import { OnClassSessionCanceledEmail } from "./on-class-session-canceled.handler.js";

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "33333333-3333-4333-8333-333333333333";
const STUDENT_A = "44444444-4444-4444-8444-444444444444";
const STUDENT_B = "55555555-5555-4555-8555-555555555555";

function candidate(email: string, locale: string): RecipientCandidate {
  return { membershipId: email, email, name: email, membershipLocale: locale, userLocale: "es-ES" };
}

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeLogger() {
  return { info: () => undefined, warn: () => undefined, error: () => undefined };
}

function buildEvent(): ClassSessionCanceled {
  return new ClassSessionCanceled({
    sessionId: SESSION_ID,
    schoolId: SCHOOL_ID,
    groupId: GROUP_ID,
    party: "school",
    canceledByMembershipId: "66666666-6666-4666-8666-666666666666",
    reason: "el profesor está enfermo",
    noticeHours: 2,
    refundDue: true,
    start: new Date("2026-09-01T08:00:00Z"),
  });
}

describe("OnClassSessionCanceledEmail", () => {
  it("avisa a cada alumno activo del grupo, cada uno en su idioma", async () => {
    const sent: unknown[] = [];
    const classes: ClassDirectoryPort = {
      activeStudentIds: async () => [STUDENT_A, STUDENT_B],
      groupIdForSession: async () => GROUP_ID,
      attendedStudentIds: async () => [],
      scheduledSessionsStartingBetween: async () => [],
    };
    const contexts: Record<string, StudentRecipientContext> = {
      [STUDENT_A]: { isMinor: false, student: candidate("a@example.com", "en-GB"), guardians: [] },
      [STUDENT_B]: { isMinor: false, student: candidate("b@example.com", "de-DE"), guardians: [] },
    };
    const people: PeopleDirectoryPort = {
      findStudentRecipientContext: async (studentId) => contexts[studentId] ?? null,
      findMembershipRecipient: async () => null,
    };
    const mailer: MailerPort = {
      send: async (params) => {
        sent.push(params);
      },
    };

    const handler = new OnClassSessionCanceledEmail(
      classes,
      people,
      mailer,
      fakeUow(),
      fakeLogger() as never,
    );
    await handler.handle(buildEvent());

    expect(sent).toEqual([
      { to: "a@example.com", locale: "en-GB", template: "class_canceled", data: expect.objectContaining({ reason: "el profesor está enfermo" }) },
      { to: "b@example.com", locale: "de-DE", template: "class_canceled", data: expect.objectContaining({ reason: "el profesor está enfermo" }) },
    ]);
  });

  it("un grupo sin matrícula activa no envía nada ni falla", async () => {
    const classes: ClassDirectoryPort = {
      activeStudentIds: async () => [],
      groupIdForSession: async () => GROUP_ID,
      attendedStudentIds: async () => [],
      scheduledSessionsStartingBetween: async () => [],
    };
    const people: PeopleDirectoryPort = {
      findStudentRecipientContext: async () => null,
      findMembershipRecipient: async () => null,
    };
    let called = false;
    const mailer: MailerPort = {
      send: async () => {
        called = true;
      },
    };

    const handler = new OnClassSessionCanceledEmail(
      classes,
      people,
      mailer,
      fakeUow(),
      fakeLogger() as never,
    );
    await handler.handle(buildEvent());

    expect(called).toBe(false);
  });

  it("el fallo al avisar a un alumno no impide avisar al resto", async () => {
    const sent: string[] = [];
    const classes: ClassDirectoryPort = {
      activeStudentIds: async () => [STUDENT_A, STUDENT_B],
      groupIdForSession: async () => GROUP_ID,
      attendedStudentIds: async () => [],
      scheduledSessionsStartingBetween: async () => [],
    };
    const contexts: Record<string, StudentRecipientContext> = {
      [STUDENT_A]: { isMinor: false, student: candidate("a@example.com", "en-GB"), guardians: [] },
      [STUDENT_B]: { isMinor: false, student: candidate("b@example.com", "de-DE"), guardians: [] },
    };
    const people: PeopleDirectoryPort = {
      findStudentRecipientContext: async (studentId) => contexts[studentId] ?? null,
      findMembershipRecipient: async () => null,
    };
    const mailer: MailerPort = {
      send: async (params) => {
        if (params.to === "a@example.com") throw new Error("Resend no responde");
        sent.push(params.to);
      },
    };

    const handler = new OnClassSessionCanceledEmail(
      classes,
      people,
      mailer,
      fakeUow(),
      fakeLogger() as never,
    );

    await expect(handler.handle(buildEvent())).resolves.toBeUndefined();
    expect(sent).toEqual(["b@example.com"]);
  });
});
