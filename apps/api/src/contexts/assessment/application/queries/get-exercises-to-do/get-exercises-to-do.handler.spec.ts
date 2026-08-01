import { describe, expect, it } from "vitest";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import type { TenantContext } from "../../../../shared/domain/ports/tenant-context.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import {
  StudentProgressAccessDeniedError,
  TeacherCannotViewStudentProgressError,
} from "../../../domain/errors/assessment.errors.js";
import type { StudentMinorPort } from "../../../domain/ports/student-minor.port.js";
import type { TeachesStudentPort } from "../../../domain/ports/teaches-student.port.js";
import type { ExerciseToDo, StudentProgressReadModel } from "../../ports/student-progress-read-model.port.js";
import { GetExercisesToDoHandler, GetExercisesToDoQuery } from "./get-exercises-to-do.handler.js";

const ALUMNO = "33333333-3333-4333-8333-333333333333";
const MEMBRESIA = "membresia-1";

const EJERCICIOS: ExerciseToDo[] = [
  {
    exerciseId: "44444444-4444-4444-8444-444444444444",
    contentUnitId: "55555555-5555-4555-8555-555555555555",
    unitCode: "ES-B1-U07",
    type: "multiple_choice",
    skill: "grammar",
    prompt: { question: "¿?", options: ["a", "b"] },
    maxScore: 1,
    requiresTeacherValidation: false,
    srsEnabled: true,
    latestAttempt: null,
  },
];

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}
function fakeTenant(roles: readonly string[], membershipId: string | null = MEMBRESIA): TenantContext {
  return {
    schoolId: () => "escuela-1",
    membershipId: () => membershipId,
    roles: () => roles,
    has: (role) => roles.includes(role),
  };
}
function fakeReadModel(): StudentProgressReadModel & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    getProgress: async () => {
      throw new Error("no debería llamarse en este doble");
    },
    exercisesForStudent: async (studentId) => {
      calls.push(studentId);
      return EJERCICIOS;
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
}) {
  const readModel = fakeReadModel();
  const teaches = fakeTeaches(params.teachesAllowed ?? false);
  const minors = fakeMinors({
    selfOrGuardianAllowed: params.selfOrGuardianAllowed ?? false,
    exists: params.exists ?? true,
  });
  const membershipId = params.membershipId === undefined ? MEMBRESIA : params.membershipId;
  const handler = new GetExercisesToDoHandler(
    readModel,
    teaches,
    minors,
    fakeTenant(params.roles, membershipId),
    fakeUow(),
  );
  return { handler, readModel, teaches, minors };
}

describe("GetExercisesToDoHandler (tarea 12 de la ola 2)", () => {
  it("un alumno que no existe en esta escuela da 404, ni siquiera para dirección", async () => {
    const { handler, readModel } = buildHandler({ roles: ["owner"], exists: false });

    await expect(
      handler.execute(new GetExercisesToDoQuery({ studentId: ALUMNO })),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(readModel.calls).toEqual([]);
  });

  it("dirección ve los ejercicios de cualquier alumno", async () => {
    const { handler, readModel, teaches, minors } = buildHandler({ roles: ["owner"] });

    const result = await handler.execute(new GetExercisesToDoQuery({ studentId: ALUMNO }));

    expect(result).toEqual(EJERCICIOS);
    expect(teaches.calls).toEqual([]);
    expect(minors.calls).toEqual([]);
    expect(readModel.calls).toEqual([ALUMNO]);
  });

  it("un profesor que da clase a este alumno ve sus ejercicios", async () => {
    const { handler, readModel } = buildHandler({ roles: ["teacher"], teachesAllowed: true });

    const result = await handler.execute(new GetExercisesToDoQuery({ studentId: ALUMNO }));

    expect(result).toEqual(EJERCICIOS);
    expect(readModel.calls).toEqual([ALUMNO]);
  });

  it("un profesor que no da clase a este alumno recibe forbidden", async () => {
    const { handler, readModel } = buildHandler({ roles: ["teacher"], teachesAllowed: false });

    await expect(
      handler.execute(new GetExercisesToDoQuery({ studentId: ALUMNO })),
    ).rejects.toBeInstanceOf(TeacherCannotViewStudentProgressError);
    expect(readModel.calls).toEqual([]);
  });

  it("el propio alumno ve sus ejercicios", async () => {
    const { handler, readModel } = buildHandler({ roles: ["student"], selfOrGuardianAllowed: true });

    const result = await handler.execute(new GetExercisesToDoQuery({ studentId: ALUMNO }));

    expect(result).toEqual(EJERCICIOS);
    expect(readModel.calls).toEqual([ALUMNO]);
  });

  it("el tutor legal ve los ejercicios de su tutelado", async () => {
    const { handler, readModel } = buildHandler({ roles: ["guardian"], selfOrGuardianAllowed: true });

    const result = await handler.execute(new GetExercisesToDoQuery({ studentId: ALUMNO }));

    expect(result).toEqual(EJERCICIOS);
    expect(readModel.calls).toEqual([ALUMNO]);
  });

  it("un alumno que pide los ejercicios de OTRO alumno recibe forbidden, no una fuga", async () => {
    const { handler, readModel } = buildHandler({ roles: ["student"], selfOrGuardianAllowed: false });

    await expect(
      handler.execute(new GetExercisesToDoQuery({ studentId: ALUMNO })),
    ).rejects.toBeInstanceOf(StudentProgressAccessDeniedError);
    expect(readModel.calls).toEqual([]);
  });
});
