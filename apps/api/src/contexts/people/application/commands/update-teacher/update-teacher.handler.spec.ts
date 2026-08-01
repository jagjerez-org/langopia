import { describe, expect, it } from "vitest";
import type { AuditLogEntry, AuditLogPort } from "../../../../shared/domain/ports/audit-log.port.js";
import type { EventPublisher } from "../../../../shared/domain/ports/event-publisher.port.js";
import type { TenantContext } from "../../../../shared/domain/ports/tenant-context.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { MembershipId, SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import { HourlyRate } from "../../../domain/model/hourly-rate.vo.js";
import { TeacherId } from "../../../domain/model/identifiers.js";
import { Teacher } from "../../../domain/model/teacher.aggregate.js";
import type { TeacherRepository } from "../../../domain/ports/teacher.repository.port.js";
import { UpdateTeacherCommand } from "./update-teacher.command.js";
import { UpdateTeacherHandler } from "./update-teacher.handler.js";

const ESCUELA = SchoolId.of("11111111-1111-4111-8111-111111111111");
const MIEMBRO = MembershipId.of("22222222-2222-4222-8222-222222222222");
const ACTOR = MembershipId.of("99999999-9999-4999-8999-999999999999");
const HIRED_AT = new Date("2024-01-01T00:00:00Z");

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeEvents(): EventPublisher {
  return { publish: async () => undefined };
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

function fakeTeachers(profesor: Teacher): TeacherRepository & { saved: Teacher[] } {
  const saved: Teacher[] = [];
  return {
    saved,
    find: async () => profesor,
    findOrFail: async () => profesor,
    save: async (t) => {
      saved.push(t);
    },
  };
}

function contratar() {
  return Teacher.hire({
    id: TeacherId.of("44444444-4444-4444-8444-444444444444"),
    schoolId: ESCUELA,
    membershipId: MIEMBRO,
    hourlyRate: HourlyRate.of("professional", 2800),
    contractedHoursPerWeek: 24,
    hiredAt: HIRED_AT,
  });
}

describe("UpdateTeacherHandler (Tarea 13)", () => {
  it("cambia la tarifa y deja rastro en auditoría con el valor anterior", async () => {
    const profesor = contratar();
    const teachers = fakeTeachers(profesor);
    const auditLog = fakeAuditLog();
    const handler = new UpdateTeacherHandler(teachers, fakeUow(), fakeEvents(), auditLog, fakeTenant());

    const result = await handler.execute(
      new UpdateTeacherCommand({ teacherId: profesor.id.value, hourlyRateCents: 3200 }),
    );

    expect(result.hourlyRateCents).toBe(3200);
    expect(teachers.saved).toHaveLength(1);
    expect(auditLog.entries[0]).toMatchObject({
      schoolId: ESCUELA.value,
      actorKind: "user",
      actorMembershipId: ACTOR.value,
      action: "people.teacher.updated",
      entityType: "teacher",
      entityId: profesor.id.value,
      before: { tier: "professional", hourlyRateCents: 2800 },
      after: { tier: "professional", hourlyRateCents: 3200 },
    });
  });

  it("rechaza el cambio de tramo si el importe deja de ser válido en él", async () => {
    const profesor = contratar();
    const teachers = fakeTeachers(profesor);
    const handler = new UpdateTeacherHandler(
      teachers,
      fakeUow(),
      fakeEvents(),
      fakeAuditLog(),
      fakeTenant(),
    );

    await expect(
      handler.execute(new UpdateTeacherCommand({ teacherId: profesor.id.value, tier: "community" })),
    ).rejects.toThrow(/tramo/i);
    expect(teachers.saved).toHaveLength(0);
  });

  it("no guarda ni audita si el PATCH no trae ningún campo", async () => {
    const profesor = contratar();
    const teachers = fakeTeachers(profesor);
    const auditLog = fakeAuditLog();
    const handler = new UpdateTeacherHandler(teachers, fakeUow(), fakeEvents(), auditLog, fakeTenant());

    await handler.execute(new UpdateTeacherCommand({ teacherId: profesor.id.value }));

    expect(teachers.saved).toHaveLength(0);
    expect(auditLog.entries).toHaveLength(0);
  });

  it("rechaza editar a un profesor de baja", async () => {
    const profesor = contratar();
    profesor.release({ reason: "x", now: HIRED_AT });
    const teachers = fakeTeachers(profesor);
    const handler = new UpdateTeacherHandler(
      teachers,
      fakeUow(),
      fakeEvents(),
      fakeAuditLog(),
      fakeTenant(),
    );

    await expect(
      handler.execute(new UpdateTeacherCommand({ teacherId: profesor.id.value, hourlyRateCents: 3000 })),
    ).rejects.toThrow(/ya está de baja/i);
  });
});
