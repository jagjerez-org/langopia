import { describe, expect, it } from "vitest";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { TenantContext } from "../../../../shared/domain/ports/tenant-context.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import {
  StudentProgressAccessDeniedError,
  TeacherCannotViewStudentProgressError,
} from "../../../domain/errors/assessment.errors.js";
import type { StudentMinorPort } from "../../../domain/ports/student-minor.port.js";
import type { TeachesStudentPort } from "../../../domain/ports/teaches-student.port.js";
import type { StudentProgress, StudentProgressReadModel } from "../../ports/student-progress-read-model.port.js";
import { GetStudentProgressHandler, GetStudentProgressQuery } from "./get-student-progress.handler.js";

const ALUMNO = "33333333-3333-4333-8333-333333333333";
const MEMBRESIA = "membresia-1";
const NOW = new Date("2026-07-27T10:00:00Z");

const PROGRESO: StudentProgress = {
  publishedExercises: 6,
  completedExercises: 3,
  completionRate: 0.5,
  validatedAttempts: 2,
  averageScore: 0.7,
  skillBreakdown: [],
  trend: [],
  reviewStreakDays: 0,
};

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}
function fakeClock(): Clock {
  return { now: () => NOW };
}
function fakeTenant(roles: readonly string[], membershipId: string | null = MEMBRESIA): TenantContext {
  return {
    schoolId: () => "escuela-1",
    membershipId: () => membershipId,
    roles: () => roles,
    has: (role) => roles.includes(role),
  };
}
function fakeReadModel(progress: StudentProgress = PROGRESO): StudentProgressReadModel & {
  calls: Array<{ studentId: string; now: Date }>;
} {
  const calls: Array<{ studentId: string; now: Date }> = [];
  return {
    calls,
    getProgress: async (params) => {
      calls.push(params);
      return progress;
    },
    exercisesForStudent: async () => {
      throw new Error("no debería llamarse en este doble");
    },
  };
}
function fakeTeaches(allowed: boolean): TeachesStudentPort & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    taught: async () => allowed,
    teachesStudent: async (params) => {
      calls.push(params);
      return allowed;
    },
  };
}
function fakeMinors(params: { selfOrGuardianAllowed: boolean; exists: boolean }): StudentMinorPort & {
  calls: unknown[];
} {
  const calls: unknown[] = [];
  return {
    calls,
    isMinor: async () => false,
    exists: async () => params.exists,
    isSelfOrGuardian: async (p) => {
      calls.push(p);
      return params.selfOrGuardianAllowed;
    },
  };
}

function buildHandler(params: {
  roles: readonly string[];
  membershipId?: string | null;
  teachesAllowed?: boolean;
  selfOrGuardianAllowed?: boolean;
  exists?: boolean;
  progress?: StudentProgress;
}) {
  const readModel = fakeReadModel(params.progress);
  const teaches = fakeTeaches(params.teachesAllowed ?? false);
  const minors = fakeMinors({
    selfOrGuardianAllowed: params.selfOrGuardianAllowed ?? false,
    exists: params.exists ?? true,
  });
  const membershipId = params.membershipId === undefined ? MEMBRESIA : params.membershipId;
  const handler = new GetStudentProgressHandler(
    readModel,
    teaches,
    minors,
    fakeTenant(params.roles, membershipId),
    fakeUow(),
    fakeClock(),
  );
  return { handler, readModel, teaches, minors };
}

describe("GetStudentProgressHandler (tarea 16 de la ola 2)", () => {
  it("un alumno que no existe en esta escuela da 404, ni siquiera para dirección (nunca alguien de otra escuela)", async () => {
    const { handler, readModel } = buildHandler({ roles: ["owner"], exists: false });

    await expect(handler.execute(new GetStudentProgressQuery({ studentId: ALUMNO }))).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(readModel.calls).toEqual([]);
  });

  it("dirección (owner) ve el progreso de cualquier alumno, sin comprobar nada más", async () => {
    const { handler, readModel, teaches, minors } = buildHandler({
      roles: ["owner"],
      teachesAllowed: false,
      selfOrGuardianAllowed: false,
    });

    const result = await handler.execute(new GetStudentProgressQuery({ studentId: ALUMNO }));

    expect(result).toEqual(PROGRESO);
    expect(teaches.calls).toEqual([]);
    expect(minors.calls).toEqual([]);
    expect(readModel.calls).toEqual([{ studentId: ALUMNO, now: NOW }]);
  });

  it("admin (dirección) igual que owner", async () => {
    const { handler, teaches, minors } = buildHandler({
      roles: ["admin"],
      teachesAllowed: false,
      selfOrGuardianAllowed: false,
    });

    await handler.execute(new GetStudentProgressQuery({ studentId: ALUMNO }));

    expect(teaches.calls).toEqual([]);
    expect(minors.calls).toEqual([]);
  });

  it("un profesor que SÍ da clase a este alumno ve su progreso", async () => {
    const { handler, readModel, teaches } = buildHandler({ roles: ["teacher"], teachesAllowed: true });

    const result = await handler.execute(new GetStudentProgressQuery({ studentId: ALUMNO }));

    expect(result).toEqual(PROGRESO);
    expect(readModel.calls).toEqual([{ studentId: ALUMNO, now: NOW }]);
    expect(teaches.calls).toEqual([{ membershipId: MEMBRESIA, studentId: expect.objectContaining({ value: ALUMNO }) }]);
  });

  it("un profesor que NO da clase a este alumno recibe forbidden, sin llegar al modelo de lectura", async () => {
    const { handler, readModel } = buildHandler({ roles: ["teacher"], teachesAllowed: false });

    await expect(handler.execute(new GetStudentProgressQuery({ studentId: ALUMNO }))).rejects.toBeInstanceOf(
      TeacherCannotViewStudentProgressError,
    );
    expect(readModel.calls).toEqual([]);
  });

  it("un profesor sin membresía resuelta (caso defensivo) también se rechaza", async () => {
    const { handler } = buildHandler({ roles: ["teacher"], membershipId: null, teachesAllowed: true });

    await expect(handler.execute(new GetStudentProgressQuery({ studentId: ALUMNO }))).rejects.toBeInstanceOf(
      TeacherCannotViewStudentProgressError,
    );
  });

  it("el propio alumno viendo su ficha ve su progreso", async () => {
    const { handler, readModel, minors } = buildHandler({ roles: ["student"], selfOrGuardianAllowed: true });

    const result = await handler.execute(new GetStudentProgressQuery({ studentId: ALUMNO }));

    expect(result).toEqual(PROGRESO);
    expect(readModel.calls).toEqual([{ studentId: ALUMNO, now: NOW }]);
    expect(minors.calls).toEqual([{ membershipId: MEMBRESIA, studentId: expect.objectContaining({ value: ALUMNO }) }]);
  });

  it("el tutor legal de este alumno ve su progreso", async () => {
    const { handler, readModel } = buildHandler({ roles: ["guardian"], selfOrGuardianAllowed: true });

    const result = await handler.execute(new GetStudentProgressQuery({ studentId: ALUMNO }));

    expect(result).toEqual(PROGRESO);
    expect(readModel.calls).toEqual([{ studentId: ALUMNO, now: NOW }]);
  });

  it("un alumno que pide el progreso de OTRO alumno (de su misma escuela) recibe forbidden, no una fuga", async () => {
    const { handler, readModel } = buildHandler({ roles: ["student"], selfOrGuardianAllowed: false });

    await expect(handler.execute(new GetStudentProgressQuery({ studentId: ALUMNO }))).rejects.toBeInstanceOf(
      StudentProgressAccessDeniedError,
    );
    expect(readModel.calls).toEqual([]);
  });

  it("un tutor que no tutela a este alumno recibe forbidden", async () => {
    const { handler } = buildHandler({ roles: ["guardian"], selfOrGuardianAllowed: false });

    await expect(handler.execute(new GetStudentProgressQuery({ studentId: ALUMNO }))).rejects.toBeInstanceOf(
      StudentProgressAccessDeniedError,
    );
  });
});
