import { describe, expect, it } from "vitest";
import type { AuditLogEntry, AuditLogPort } from "../../../../shared/domain/ports/audit-log.port.js";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { EventPublisher } from "../../../../shared/domain/ports/event-publisher.port.js";
import type { TenantContext } from "../../../../shared/domain/ports/tenant-context.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { MembershipId, SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import { DateOfBirth } from "../../../domain/model/date-of-birth.vo.js";
import { StudentId } from "../../../domain/model/identifiers.js";
import { Student } from "../../../domain/model/student.aggregate.js";
import type { StudentRepository } from "../../../domain/ports/student.repository.port.js";
import { UpdateStudentCommand } from "./update-student.command.js";
import { UpdateStudentHandler } from "./update-student.handler.js";

const AHORA = new Date("2026-07-25T12:00:00Z");
const ESCUELA = SchoolId.of("11111111-1111-4111-8111-111111111111");
const MIEMBRO = MembershipId.of("22222222-2222-4222-8222-222222222222");
const ACTOR = MembershipId.of("99999999-9999-4999-8999-999999999999");

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeEvents(): EventPublisher {
  return { publish: async () => undefined };
}

function fakeClock(): Clock {
  return { now: () => AHORA };
}

function fakeTenant(): TenantContext {
  return {
    schoolId: () => ESCUELA.value,
    membershipId: () => ACTOR.value,
    roles: () => ["owner"],
    has: () => true,
  };
}

function fakeAuditLog(): AuditLogPort & { entries: AuditLogEntry[] } {
  const entries: AuditLogEntry[] = [];
  return {
    entries,
    record: async (entry) => {
      entries.push(entry);
    },
  };
}

function fakeStudents(adulto: Student): StudentRepository & { saved: Student[] } {
  const saved: Student[] = [];
  return {
    saved,
    find: async () => adulto,
    findOrFail: async () => adulto,
    save: async (s) => {
      saved.push(s);
    },
    countActive: async () => 1,
  };
}

function alumno(edad: number) {
  const anio = 2026 - edad;
  return Student.enrol({
    id: StudentId.of("44444444-4444-4444-8444-444444444444"),
    schoolId: ESCUELA,
    membershipId: MIEMBRO,
    dateOfBirth: DateOfBirth.of(`${anio}-01-01`),
    nativeLanguage: "es",
    targetLanguage: "en",
    now: AHORA,
  });
}

describe("UpdateStudentHandler (Tarea 13)", () => {
  it("corrige la fecha de nacimiento y deja rastro en auditoría con el valor anterior", async () => {
    const estudiante = alumno(30);
    const students = fakeStudents(estudiante);
    const auditLog = fakeAuditLog();
    const handler = new UpdateStudentHandler(
      students,
      fakeUow(),
      fakeEvents(),
      auditLog,
      fakeTenant(),
      fakeClock(),
    );

    const result = await handler.execute(
      new UpdateStudentCommand({ studentId: estudiante.id.value, dateOfBirth: "1990-06-15" }),
    );

    expect(result.studentId).toBe(estudiante.id.value);
    expect(estudiante.dateOfBirth.value).toBe("1990-06-15");
    expect(students.saved).toHaveLength(1);
    expect(auditLog.entries).toHaveLength(1);
    expect(auditLog.entries[0]).toMatchObject({
      schoolId: ESCUELA.value,
      actorKind: "user",
      actorMembershipId: ACTOR.value,
      action: "people.student.updated",
      entityType: "student",
      entityId: estudiante.id.value,
      before: { dateOfBirth: "1996-01-01" },
      after: { dateOfBirth: "1990-06-15" },
    });
  });

  it("ajusta el nivel MCER y audita el valor anterior, aunque fuera nulo", async () => {
    const estudiante = alumno(30);
    const students = fakeStudents(estudiante);
    const auditLog = fakeAuditLog();
    const handler = new UpdateStudentHandler(
      students,
      fakeUow(),
      fakeEvents(),
      auditLog,
      fakeTenant(),
      fakeClock(),
    );

    await handler.execute(
      new UpdateStudentCommand({ studentId: estudiante.id.value, currentLevel: "B1" }),
    );

    expect(estudiante.currentLevel).toBe("B1");
    expect(auditLog.entries[0]).toMatchObject({
      before: { currentLevel: null },
      after: { currentLevel: "B1" },
    });
  });

  it("no guarda ni audita si el PATCH no trae ningún campo", async () => {
    const estudiante = alumno(30);
    const students = fakeStudents(estudiante);
    const auditLog = fakeAuditLog();
    const handler = new UpdateStudentHandler(
      students,
      fakeUow(),
      fakeEvents(),
      auditLog,
      fakeTenant(),
      fakeClock(),
    );

    await handler.execute(new UpdateStudentCommand({ studentId: estudiante.id.value }));

    expect(students.saved).toHaveLength(0);
    expect(auditLog.entries).toHaveLength(0);
  });

  it("rechaza editar a un alumno de baja", async () => {
    const estudiante = alumno(30);
    estudiante.leave({ reason: "x", now: AHORA });
    const students = fakeStudents(estudiante);
    const handler = new UpdateStudentHandler(
      students,
      fakeUow(),
      fakeEvents(),
      fakeAuditLog(),
      fakeTenant(),
      fakeClock(),
    );

    await expect(
      handler.execute(new UpdateStudentCommand({ studentId: estudiante.id.value, currentLevel: "B1" })),
    ).rejects.toThrow(/ya está de baja/i);
  });
});
