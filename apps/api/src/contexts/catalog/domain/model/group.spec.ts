import { describe, expect, it } from "vitest";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { GroupFullError, NegativeAgreedPriceError, StudentNotActiveError } from "../errors/catalog.errors.js";
import { GroupStatus } from "./group-status.js";
import { Group } from "./group.aggregate.js";
import { CourseId, EnrollmentId, GroupId, StudentId, TeacherId } from "./identifiers.js";

const NOW = new Date("2026-09-01T09:00:00Z");
const SCHOOL = SchoolId.of("11111111-1111-4111-8111-111111111111");
const COURSE = CourseId.of("22222222-2222-4222-8222-222222222222");
const TEACHER = TeacherId.of("33333333-3333-4333-8333-333333333333");

function newGroup(capacity: number) {
  return Group.create({
    id: GroupId.of("44444444-4444-4444-8444-444444444444"),
    schoolId: SCHOOL,
    courseId: COURSE,
    teacherId: TEACHER,
    name: "Grupo de prueba",
    capacity,
    startsOn: new Date("2026-09-07T00:00:00Z"),
  });
}

function studentId(n: number): StudentId {
  return StudentId.of(`5555555${n}-5555-4555-8555-555555555555`);
}

function enrol(group: Group, n: number, opts: { studentActive?: boolean; agreedPriceCents?: number | null } = {}) {
  return group.enrol({
    enrollmentId: EnrollmentId.of(`6666666${n}-6666-4666-8666-666666666666`),
    studentId: studentId(n),
    studentActive: opts.studentActive ?? true,
    agreedPriceCents: opts.agreedPriceCents ?? null,
    now: NOW,
  });
}

describe("Group.enrol()", () => {
  it("matricula a un alumno activo dentro de la capacidad y emite el evento", () => {
    const group = newGroup(5);
    group.pullDomainEvents();
    const enrollment = enrol(group, 1);

    expect(enrollment.studentId.equals(studentId(1))).toBe(true);
    expect(group.enrollments).toHaveLength(1);
    const events = group.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]!.eventName).toBe("catalog.group.student_enrolled");
  });

  it("no admite más matrículas que su capacity, y al llenarse emite GroupFull", () => {
    const group = newGroup(2);
    enrol(group, 1);
    group.pullDomainEvents();

    // La segunda matrícula agota la capacidad: debe emitir StudentEnrolledInGroup y GroupFull.
    enrol(group, 2);
    const events = group.pullDomainEvents().map((e) => e.eventName);
    expect(events).toEqual(["catalog.group.student_enrolled", "catalog.group.full"]);

    // Una tercera, sobre un grupo ya lleno, es invariant_violation.
    expect(() => enrol(group, 3)).toThrow(GroupFullError);
    try {
      enrol(group, 3);
    } catch (error) {
      expect((error as GroupFullError).kind).toBe("invariant_violation");
    }
  });

  it("un curso privado (capacidad 1) rechaza un segundo alumno: invariant_violation", () => {
    const group = newGroup(1);
    enrol(group, 1);

    expect(() => enrol(group, 2)).toThrow(GroupFullError);
    try {
      enrol(group, 2);
    } catch (error) {
      expect((error as GroupFullError).kind).toBe("invariant_violation");
    }
  });

  it("no matricula a un alumno de baja", () => {
    const group = newGroup(5);
    expect(() => enrol(group, 1, { studentActive: false })).toThrow(StudentNotActiveError);
  });

  it("el precio acordado puede ser menor que el de catálogo, pero nunca negativo", () => {
    const group = newGroup(5);
    // Menor que el de catálogo (beca): se acepta sin más.
    const enrollment = enrol(group, 1, { agreedPriceCents: 100 });
    expect(enrollment.agreedPriceCents).toBe(100);

    expect(() => enrol(group, 2, { agreedPriceCents: -1 })).toThrow(NegativeAgreedPriceError);
  });
});

describe("Group.start()", () => {
  it("pasa de planned a running y emite GroupStarted", () => {
    const group = newGroup(5);
    expect(group.status).toBe(GroupStatus.Planned);
    group.start(NOW);
    expect(group.status).toBe(GroupStatus.Running);
    const events = group.pullDomainEvents();
    expect(events[0]!.eventName).toBe("catalog.group.started");
  });

  it("no se puede iniciar dos veces", () => {
    const group = newGroup(5);
    group.start(NOW);
    expect(() => group.start(NOW)).toThrow(/no se puede iniciar/);
  });
});
