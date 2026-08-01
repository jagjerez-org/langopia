import { describe, expect, it } from "vitest";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { AttendanceSheet } from "./attendance.aggregate.js";
import { AttendanceSource, AttendanceStatus } from "./attendance-status.js";
import { AttendanceId, GroupId, SessionId, StudentId } from "./identifiers.js";

const SCHOOL = SchoolId.of("11111111-1111-4111-8111-111111111111");
const GROUP = GroupId.of("22222222-2222-4222-8222-222222222222");
const SESSION = SessionId.of("55555555-5555-4555-8555-555555555555");
const ACTOR = MembershipId.of("44444444-4444-4444-8444-444444444444");

const LUCIA = StudentId.of("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const SARA = StudentId.of("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const NOT_ENROLLED = StudentId.of("cccccccc-cccc-4ccc-8ccc-cccccccccccc");

const SESSION_START = new Date("2026-09-01T09:00:00Z");
const DURING_CLASS = new Date("2026-09-01T09:05:00Z");
const BEFORE_CLASS = new Date("2026-09-01T08:00:00Z");

let nextId = 0;
function entryId(): AttendanceId {
  nextId += 1;
  return AttendanceId.of(`d0000000-0000-4000-8000-00000000${String(nextId).padStart(4, "0")}`);
}

function openSheet(roster: StudentId[] = [LUCIA, SARA]): AttendanceSheet {
  return AttendanceSheet.open({
    sessionId: SESSION,
    schoolId: SCHOOL,
    groupId: GROUP,
    sessionStart: SESSION_START,
    enrolledStudentIds: roster,
  });
}

describe("AttendanceSheet", () => {
  it("marca presente a un alumno matriculado y emite AttendanceRecorded", () => {
    const sheet = openSheet();
    sheet.markPresent({ entryId: entryId(), studentId: LUCIA, now: DURING_CLASS, recordedBy: ACTOR });

    const events = sheet.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]!.eventName).toBe("scheduling.attendance.recorded");
    expect(events[0]!.payload()).toMatchObject({
      studentId: LUCIA.value,
      status: AttendanceStatus.Present,
      source: AttendanceSource.Manual,
    });
    expect(sheet.entries).toHaveLength(1);
    expect(sheet.entries[0]!.status).toBe(AttendanceStatus.Present);
  });

  it("marca ausente a un alumno matriculado", () => {
    const sheet = openSheet();
    sheet.markAbsent({ entryId: entryId(), studentId: SARA, now: DURING_CLASS });

    expect(sheet.entries).toHaveLength(1);
    expect(sheet.entries[0]!.status).toBe(AttendanceStatus.Absent);
    expect(sheet.entries[0]!.source).toBe(AttendanceSource.Manual);
  });

  it("marcar a un alumno no matriculado en el grupo es invariant_violation", () => {
    const sheet = openSheet();
    const mark = () => sheet.markPresent({ entryId: entryId(), studentId: NOT_ENROLLED, now: DURING_CLASS });

    expect(mark).toThrow(/no está matriculado/);
    try {
      mark();
      expect.unreachable();
    } catch (error) {
      expect((error as { kind: string }).kind).toBe("invariant_violation");
      expect((error as { code: string }).code).toBe("student_not_enrolled");
    }
  });

  it("no se puede pasar lista de una clase que aún no ha empezado", () => {
    const sheet = openSheet();
    const mark = () => sheet.markPresent({ entryId: entryId(), studentId: LUCIA, now: BEFORE_CLASS });

    expect(mark).toThrow(/todavía no ha empezado/);
    expect(sheet.entries).toHaveLength(0);
  });

  it("importFrom guarda siempre origen «imported», sea cual sea el estado importado", () => {
    const sheet = openSheet();
    sheet.importFrom(
      [
        { entryId: entryId(), studentId: LUCIA, status: AttendanceStatus.Late },
        { entryId: entryId(), studentId: SARA, status: AttendanceStatus.Excused },
      ],
      { now: DURING_CLASS },
    );

    expect(sheet.entries.every((e) => e.source === AttendanceSource.Imported)).toBe(true);
    expect(sheet.entries.map((e) => e.status).sort()).toEqual(
      [AttendanceStatus.Late, AttendanceStatus.Excused].sort(),
    );
  });

  it("cuando toda la hoja está cubierta y todos asistieron, la marca final señala la clase como completa y con asistentes", () => {
    const sheet = openSheet();
    sheet.markPresent({ entryId: entryId(), studentId: LUCIA, now: DURING_CLASS });
    sheet.pullDomainEvents();

    sheet.markPresent({ entryId: entryId(), studentId: SARA, now: DURING_CLASS });
    const [event] = sheet.pullDomainEvents();

    expect(sheet.isFullyCovered).toBe(true);
    expect(sheet.anyoneAttended).toBe(true);
    expect(event!.payload()).toMatchObject({ sheetComplete: true, anyoneAttended: true });
  });

  it("cuando toda la hoja está cubierta pero nadie asistió, anyoneAttended es false (no_show, no completed)", () => {
    const sheet = openSheet();
    sheet.markAbsent({ entryId: entryId(), studentId: LUCIA, now: DURING_CLASS });
    sheet.markAbsent({ entryId: entryId(), studentId: SARA, now: DURING_CLASS });
    const [event] = sheet.pullDomainEvents().slice(-1);

    expect(sheet.isFullyCovered).toBe(true);
    expect(sheet.anyoneAttended).toBe(false);
    expect(event!.payload()).toMatchObject({ sheetComplete: true, anyoneAttended: false });
  });

  it("la hoja no está cubierta mientras falte algún alumno del grupo por marcar", () => {
    const sheet = openSheet();
    sheet.markPresent({ entryId: entryId(), studentId: LUCIA, now: DURING_CLASS });
    const [event] = sheet.pullDomainEvents();

    expect(sheet.isFullyCovered).toBe(false);
    expect(event!.payload()).toMatchObject({ sheetComplete: false });
  });

  it("volver a marcar al mismo alumno sustituye la entrada anterior, no la duplica", () => {
    const sheet = openSheet();
    sheet.markAbsent({ entryId: entryId(), studentId: LUCIA, now: DURING_CLASS });
    sheet.markPresent({ entryId: entryId(), studentId: LUCIA, now: DURING_CLASS });

    expect(sheet.entries).toHaveLength(1);
    expect(sheet.entries[0]!.status).toBe(AttendanceStatus.Present);
  });
});
