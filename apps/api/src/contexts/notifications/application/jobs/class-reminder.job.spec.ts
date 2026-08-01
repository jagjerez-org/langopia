import { AsyncLocalStorage } from "node:async_hooks";
import { ClsService } from "nestjs-cls";
import { describe, expect, it } from "vitest";
import type { Clock } from "../../../shared/domain/ports/clock.port.js";
import type { UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import type { RecipientCandidate } from "../../domain/model/recipient.js";
import type { ClassDirectoryPort, UpcomingSession } from "../../domain/ports/class-directory.port.js";
import type { MailerPort } from "../../domain/ports/mailer.port.js";
import type {
  PeopleDirectoryPort,
  StudentRecipientContext,
} from "../../domain/ports/people-directory.port.js";
import type { SchoolDirectoryPort } from "../../domain/ports/school-directory.port.js";
import { ClassReminderJob } from "./class-reminder.job.js";

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "22222222-2222-4222-8222-222222222222";
const STUDENT_ID = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-07-27T10:00:00Z");
/** Exactamente 24 h por delante de `NOW`: cae dentro de la ventana de esta ejecución. */
const IN_WINDOW = new Date("2026-07-28T10:30:00Z");

function candidate(): RecipientCandidate {
  return {
    membershipId: STUDENT_ID,
    email: "alumno@example.com",
    name: "Nerea",
    membershipLocale: "de-DE",
    userLocale: "es-ES",
  };
}

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeLogger() {
  return { info: () => undefined, warn: () => undefined, error: () => undefined };
}

function buildJob(params: {
  sessions: UpcomingSession[];
  studentIds?: string[];
  context?: StudentRecipientContext | null;
}) {
  const sent: unknown[] = [];
  const windowCalls: Array<{ from: Date; to: Date }> = [];

  const cls = new ClsService(new AsyncLocalStorage());
  const schools: SchoolDirectoryPort = { allIds: async () => [SCHOOL_ID] };
  const classes: ClassDirectoryPort = {
    activeStudentIds: async () => params.studentIds ?? [STUDENT_ID],
    groupIdForSession: async () => GROUP_ID,
    attendedStudentIds: async () => [],
    scheduledSessionsStartingBetween: async (from, to) => {
      windowCalls.push({ from, to });
      return params.sessions;
    },
  };
  const people: PeopleDirectoryPort = {
    findStudentRecipientContext: async () =>
      params.context !== undefined ? params.context : { isMinor: false, student: candidate(), guardians: [] },
    findMembershipRecipient: async () => null,
  };
  const mailer: MailerPort = {
    send: async (p) => {
      sent.push(p);
    },
  };
  const clock: Clock = { now: () => NOW };
  const logger = fakeLogger();

  const job = new ClassReminderJob(
    cls,
    fakeUow(),
    schools,
    classes,
    people,
    mailer,
    clock,
    logger as never,
  );

  return { job, sent, windowCalls };
}

describe("ClassReminderJob (paso 7 del brief: recordatorio 24 h antes)", () => {
  it("mira una ventana de una hora que empieza 24 horas por delante de ahora", async () => {
    const { job, windowCalls } = buildJob({ sessions: [] });
    await job.run();

    expect(windowCalls).toEqual([{ from: new Date("2026-07-28T10:00:00Z"), to: new Date("2026-07-28T11:00:00Z") }]);
  });

  it("una clase dentro de la ventana genera un recordatorio por cada alumno activo del grupo", async () => {
    const session: UpcomingSession = { sessionId: "sesion-1", groupId: GROUP_ID, start: IN_WINDOW };
    const { job, sent } = buildJob({ sessions: [session] });

    await job.run();

    expect(sent).toEqual([
      {
        to: "alumno@example.com",
        locale: "de-DE",
        template: "class_reminder",
        data: { name: "Nerea", startsAt: IN_WINDOW.toISOString() },
      },
    ]);
  });

  it("no envía nada si no hay clases en la ventana", async () => {
    const { job, sent } = buildJob({ sessions: [] });
    await job.run();
    expect(sent).toEqual([]);
  });

  it("un alumno sin ficha no revienta el trabajo ni impide seguir con el resto", async () => {
    const session: UpcomingSession = { sessionId: "sesion-1", groupId: GROUP_ID, start: IN_WINDOW };
    const { job, sent } = buildJob({ sessions: [session], context: null });

    await expect(job.run()).resolves.toBeUndefined();
    expect(sent).toEqual([]);
  });

  it("un fallo de envío para un alumno no impide recordar al resto", async () => {
    const session: UpcomingSession = { sessionId: "sesion-1", groupId: GROUP_ID, start: IN_WINDOW };
    const cls = new ClsService(new AsyncLocalStorage());
    const schools: SchoolDirectoryPort = { allIds: async () => [SCHOOL_ID] };
    const classes: ClassDirectoryPort = {
      activeStudentIds: async () => ["alumno-falla", "alumno-ok"],
      groupIdForSession: async () => GROUP_ID,
      attendedStudentIds: async () => [],
      scheduledSessionsStartingBetween: async () => [session],
    };
    const sent: string[] = [];
    const people: PeopleDirectoryPort = {
      findStudentRecipientContext: async (studentId): Promise<StudentRecipientContext> => ({
        isMinor: false,
        student: { ...candidate(), email: `${studentId}@example.com` },
        guardians: [],
      }),
      findMembershipRecipient: async () => null,
    };
    const mailer: MailerPort = {
      send: async (p) => {
        if (p.to === "alumno-falla@example.com") throw new Error("Resend no responde");
        sent.push(p.to);
      },
    };

    const job = new ClassReminderJob(
      cls,
      fakeUow(),
      schools,
      classes,
      people,
      mailer,
      { now: () => NOW },
      fakeLogger() as never,
    );

    await expect(job.run()).resolves.toBeUndefined();
    expect(sent).toEqual(["alumno-ok@example.com"]);
  });
});
