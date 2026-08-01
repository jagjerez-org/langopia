import type { PinoLogger } from "nestjs-pino";
import { describe, expect, it, vi } from "vitest";
import type { Clock } from "../../../shared/domain/ports/clock.port.js";
import type { EventPublisher } from "../../../shared/domain/ports/event-publisher.port.js";
import type { UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { AttendanceRecorded } from "../../domain/events/attendance.events.js";
import { AttendanceSource, AttendanceStatus } from "../../domain/model/attendance-status.js";
import { CancellationPolicy } from "../../domain/model/cancellation-policy.js";
import { ClassSession } from "../../domain/model/class-session.aggregate.js";
import { GroupId, SessionId, TeacherId } from "../../domain/model/identifiers.js";
import { Room, RoomProvider } from "../../domain/model/room.vo.js";
import { SessionStatus } from "../../domain/model/session-status.js";
import { TimeSlot } from "../../domain/model/time-slot.vo.js";
import type { ClassSessionRepository } from "../../domain/ports/class-session.repository.port.js";
import { OnAttendanceRecorded } from "./on-attendance-recorded.handler.js";

const SESSION_ID = "55555555-5555-4555-8555-555555555555";
const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "22222222-2222-4222-8222-222222222222";
const STUDENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = new Date("2026-09-01T09:30:00Z");

function buildEvent(overrides: { sheetComplete: boolean; anyoneAttended: boolean }): AttendanceRecorded {
  return new AttendanceRecorded({
    sessionId: SESSION_ID,
    schoolId: SCHOOL_ID,
    groupId: GROUP_ID,
    studentId: STUDENT_ID,
    status: AttendanceStatus.Present,
    source: AttendanceSource.Manual,
    ...overrides,
  });
}

function newSession(): ClassSession {
  const session = ClassSession.schedule({
    id: SessionId.of(SESSION_ID),
    schoolId: SchoolId.of(SCHOOL_ID),
    groupId: GroupId.of(GROUP_ID),
    teacherId: TeacherId.of("33333333-3333-4333-8333-333333333333"),
    slot: TimeSlot.fromDuration(new Date("2026-09-01T09:00:00Z"), 60),
    room: Room.of({ provider: RoomProvider.LiveKit, url: "https://aula.langopia.app/x" }),
    now: new Date("2026-08-01T00:00:00Z"),
  });
  session.pullDomainEvents();
  return session;
}

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeLogger(): PinoLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as PinoLogger;
}

function fakeClock(): Clock {
  return { now: () => NOW };
}

describe("OnAttendanceRecorded", () => {
  it("si la hoja no está completa, no toca la clase", async () => {
    const findOrFail = vi.fn();
    const sessions = { findOrFail, save: vi.fn() } as unknown as ClassSessionRepository;
    const events: EventPublisher = { publish: vi.fn() };

    const handler = new OnAttendanceRecorded(sessions, fakeUow(), events, fakeClock(), fakeLogger());
    await handler.handle(buildEvent({ sheetComplete: false, anyoneAttended: false }));

    expect(findOrFail).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });

  it("si la hoja está completa y hubo asistentes, cierra la clase como completed", async () => {
    const session = newSession();
    const save = vi.fn().mockResolvedValue(undefined);
    const sessions = {
      findOrFail: vi.fn().mockResolvedValue(session),
      save,
    } as unknown as ClassSessionRepository;
    const publish = vi.fn().mockResolvedValue(undefined);
    const events: EventPublisher = { publish };

    const handler = new OnAttendanceRecorded(sessions, fakeUow(), events, fakeClock(), fakeLogger());
    await handler.handle(buildEvent({ sheetComplete: true, anyoneAttended: true }));

    expect(session.status).toBe(SessionStatus.Completed);
    expect(save).toHaveBeenCalledWith(session);
    expect(publish).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ eventName: "scheduling.class_session.completed" })]),
    );
  });

  it("si la hoja está completa pero nadie asistió, la clase queda no_show", async () => {
    const session = newSession();
    const sessions = {
      findOrFail: vi.fn().mockResolvedValue(session),
      save: vi.fn().mockResolvedValue(undefined),
    } as unknown as ClassSessionRepository;
    const events: EventPublisher = { publish: vi.fn().mockResolvedValue(undefined) };

    const handler = new OnAttendanceRecorded(sessions, fakeUow(), events, fakeClock(), fakeLogger());
    await handler.handle(buildEvent({ sheetComplete: true, anyoneAttended: false }));

    expect(session.status).toBe(SessionStatus.NoShow);
  });

  it("si la clase ya estaba cerrada por otra vía, no relanza complete()", async () => {
    const session = newSession();
    session.cancel({
      party: "school",
      by: MembershipId.of("44444444-4444-4444-8444-444444444444"),
      reason: "x",
      policy: CancellationPolicy.default(),
      now: new Date("2026-08-15T00:00:00Z"),
    });
    session.pullDomainEvents();

    const save = vi.fn();
    const sessions = {
      findOrFail: vi.fn().mockResolvedValue(session),
      save,
    } as unknown as ClassSessionRepository;
    const events: EventPublisher = { publish: vi.fn().mockResolvedValue(undefined) };

    const handler = new OnAttendanceRecorded(sessions, fakeUow(), events, fakeClock(), fakeLogger());
    await expect(
      handler.handle(buildEvent({ sheetComplete: true, anyoneAttended: true })),
    ).resolves.toBeUndefined();

    expect(save).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });
});
