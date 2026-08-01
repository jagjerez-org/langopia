import { describe, expect, it } from "vitest";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { CancellationPolicy } from "./cancellation-policy.js";
import { ClassSession } from "./class-session.aggregate.js";
import { GroupId, SessionId, TeacherId } from "./identifiers.js";
import { Room, RoomProvider } from "./room.vo.js";
import { CancelingParty, SessionStatus } from "./session-status.js";
import { TimeSlot } from "./time-slot.vo.js";

const NOW = new Date("2026-09-01T09:00:00Z");
const SCHOOL = SchoolId.of("11111111-1111-4111-8111-111111111111");
const GROUP = GroupId.of("22222222-2222-4222-8222-222222222222");
const TEACHER = TeacherId.of("33333333-3333-4333-8333-333333333333");
const ACTOR = MembershipId.of("44444444-4444-4444-8444-444444444444");

function newSession(daysAhead = 7) {
  const startsAt = new Date(NOW.getTime() + daysAhead * 86_400_000);
  return ClassSession.schedule({
    id: SessionId.of("55555555-5555-4555-8555-555555555555"),
    schoolId: SCHOOL,
    groupId: GROUP,
    teacherId: TEACHER,
    slot: TimeSlot.fromDuration(startsAt, 60),
    room: Room.of({ provider: RoomProvider.LiveKit, url: "https://aula.langopia.app/x" }),
    now: NOW,
  });
}

describe("ClassSession", () => {
  it("al programarse emite el evento correspondiente", () => {
    const session = newSession();
    const events = session.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]!.eventName).toBe("scheduling.class_session.scheduled");
  });

  it("no se puede programar en el pasado", () => {
    expect(() => newSession(-1)).toThrow(/pasado/);
  });

  it("al cancelar congela si procede devolución", () => {
    const session = newSession();
    session.pullDomainEvents();
    session.cancel({
      party: CancelingParty.Student,
      by: ACTOR,
      reason: "Viaje",
      policy: CancellationPolicy.default(),
      now: NOW,
    });
    expect(session.status).toBe(SessionStatus.CanceledByStudent);
    expect(session.cancellation!.refundDue).toBe(true);
    expect(session.pullDomainEvents()[0]!.eventName).toBe("scheduling.class_session.canceled");
  });

  it("no se puede cancelar dos veces", () => {
    const session = newSession();
    const cancel = () =>
      session.cancel({
        party: CancelingParty.School,
        by: ACTOR,
        reason: "x",
        policy: CancellationPolicy.default(),
        now: NOW,
      });
    cancel();
    // Nota: la redacción exacta del brief («cancel una session en estado») no
    // coincide con el mensaje real de SessionAlreadyClosedError, que está en
    // español y usa «clase» (scheduling.errors.ts, fuera del alcance de esta
    // tarea). Se comprueba aquí el mensaje real que lanza el dominio.
    expect(cancel).toThrow(/cancelar.*en estado/);
  });

  it("al replanificar cierra la original y devuelve la sustituta", () => {
    const session = newSession();
    session.pullDomainEvents();
    const replacement = session.rescheduleTo({
      newSessionId: SessionId.of("66666666-6666-4666-8666-666666666666"),
      newSlot: session.slot.movedTo(new Date("2026-09-10T16:00:00Z")),
      reason: "Conflicto de agenda",
      now: NOW,
    });
    expect(session.status).toBe(SessionStatus.Rescheduled);
    expect(replacement.status).toBe(SessionStatus.Scheduled);
    expect(replacement.rescheduledFrom!.value).toBe(session.id.value);
    expect(replacement.slot.durationMinutes).toBe(60);
  });

  it("una clase a la que no se conectó nadie no es «completada» sino «sin asistentes»", () => {
    const session = newSession();
    session.complete({ now: NOW, anyoneAttended: false });
    expect(session.status).toBe(SessionStatus.NoShow);
    expect(session.pullDomainEvents().filter((e) => e.eventName.endsWith("completed"))).toHaveLength(0);
  });

  it("una clase completada emite el evento con la capacidad de transcripción del aula", () => {
    const session = newSession();
    session.pullDomainEvents();
    session.complete({ now: NOW, anyoneAttended: true });
    const event = session.pullDomainEvents()[0]!;
    expect(event.eventName).toBe("scheduling.class_session.completed");
    expect(event.payload().transcriptionCapable).toBe(true);
  });

  it("una clase cancelada no cuenta para la ocupación del profesor", () => {
    const session = newSession();
    expect(session.countsTowardsOccupancy).toBe(true);
    session.cancel({
      party: CancelingParty.School,
      by: ACTOR,
      reason: "x",
      policy: CancellationPolicy.default(),
      now: NOW,
    });
    expect(session.countsTowardsOccupancy).toBe(false);
  });
});
