import { describe, expect, it } from "vitest";
import { StudentEnrolled } from "../../../people/domain/events/student.events.js";
import type { UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import type { GuardianCandidate, RecipientCandidate } from "../../domain/model/recipient.js";
import type { MailerPort } from "../../domain/ports/mailer.port.js";
import type {
  PeopleDirectoryPort,
  StudentRecipientContext,
} from "../../domain/ports/people-directory.port.js";
import { OnStudentEnrolled } from "./on-student-enrolled.handler.js";

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const STUDENT_ID = "22222222-2222-4222-8222-222222222222";

const ADULT: RecipientCandidate = {
  membershipId: "33333333-3333-4333-8333-333333333333",
  email: "adulto@example.com",
  name: "Nerea",
  membershipLocale: "de-DE",
  userLocale: "es-ES",
};

const TUTOR: GuardianCandidate = {
  membershipId: "44444444-4444-4444-8444-444444444444",
  email: "tutor@example.com",
  name: "Tutor",
  membershipLocale: "pt-BR",
  userLocale: "es-ES",
  isBillingContact: true,
};

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeLogger() {
  return { info: () => undefined, warn: () => undefined, error: () => undefined };
}

describe("OnStudentEnrolled", () => {
  it("un alumno adulto recibe la bienvenida en el idioma de su membresía", async () => {
    const sent: unknown[] = [];
    const people: PeopleDirectoryPort = {
      findStudentRecipientContext: async (): Promise<StudentRecipientContext> => ({
        isMinor: false,
        student: ADULT,
        guardians: [],
      }),
      findMembershipRecipient: async () => null,
    };
    const mailer: MailerPort = {
      send: async (params) => {
        sent.push(params);
      },
    };

    const handler = new OnStudentEnrolled(people, mailer, fakeUow(), fakeLogger() as never);
    await handler.handle(new StudentEnrolled({ studentId: STUDENT_ID, schoolId: SCHOOL_ID, isMinor: false }));

    expect(sent).toEqual([
      { to: "adulto@example.com", locale: "de-DE", template: "student_welcome", data: { name: "Nerea" } },
    ]);
  });

  it("un alumno menor recibe la bienvenida en el tutor, no en él", async () => {
    const sent: unknown[] = [];
    const people: PeopleDirectoryPort = {
      findStudentRecipientContext: async (): Promise<StudentRecipientContext> => ({
        isMinor: true,
        student: { ...ADULT, email: "menor@example.com" },
        guardians: [TUTOR],
      }),
      findMembershipRecipient: async () => null,
    };
    const mailer: MailerPort = {
      send: async (params) => {
        sent.push(params);
      },
    };

    const handler = new OnStudentEnrolled(people, mailer, fakeUow(), fakeLogger() as never);
    await handler.handle(new StudentEnrolled({ studentId: STUDENT_ID, schoolId: SCHOOL_ID, isMinor: true }));

    expect(sent).toEqual([
      { to: "tutor@example.com", locale: "pt-BR", template: "student_welcome", data: { name: "Tutor" } },
    ]);
  });

  it("si la ficha del alumno no existe, no envía nada ni revienta", async () => {
    const sent: unknown[] = [];
    const people: PeopleDirectoryPort = {
      findStudentRecipientContext: async () => null,
      findMembershipRecipient: async () => null,
    };
    const mailer: MailerPort = {
      send: async (params) => {
        sent.push(params);
      },
    };

    const handler = new OnStudentEnrolled(people, mailer, fakeUow(), fakeLogger() as never);
    await handler.handle(new StudentEnrolled({ studentId: STUDENT_ID, schoolId: SCHOOL_ID, isMinor: false }));

    expect(sent).toEqual([]);
  });

  it("un fallo de envío no revienta el manejador: se registra y sigue", async () => {
    const people: PeopleDirectoryPort = {
      findStudentRecipientContext: async (): Promise<StudentRecipientContext> => ({
        isMinor: false,
        student: ADULT,
        guardians: [],
      }),
      findMembershipRecipient: async () => null,
    };
    const mailer: MailerPort = {
      send: async () => {
        throw new Error("Resend no responde");
      },
    };

    const handler = new OnStudentEnrolled(people, mailer, fakeUow(), fakeLogger() as never);

    await expect(
      handler.handle(new StudentEnrolled({ studentId: STUDENT_ID, schoolId: SCHOOL_ID, isMinor: false })),
    ).resolves.toBeUndefined();
  });
});
