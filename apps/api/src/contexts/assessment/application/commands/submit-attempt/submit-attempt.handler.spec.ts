import type { PinoLogger } from "nestjs-pino";
import { describe, expect, it, vi } from "vitest";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { EventPublisher } from "../../../../shared/domain/ports/event-publisher.port.js";
import type { IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import type { TenantContext } from "../../../../shared/domain/ports/tenant-context.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { AttemptAccessDeniedError } from "../../../domain/errors/assessment.errors.js";
import { Attempt, AttemptStatus } from "../../../domain/model/attempt.aggregate.js";
import type { AttemptRepository } from "../../../domain/ports/attempt.repository.port.js";
import type { ExerciseSourceInfo, ExerciseSourcePort } from "../../../domain/ports/exercise-source.port.js";
import type { StudentMinorPort } from "../../../domain/ports/student-minor.port.js";
import type { CorrectionCost, WritingCorrectorPort } from "../../../domain/ports/writing-corrector.port.js";
import { SubmitAttemptCommand } from "./submit-attempt.command.js";
import { SubmitAttemptHandler } from "./submit-attempt.handler.js";

const ESCUELA = "11111111-1111-4111-8111-111111111111";
const EJERCICIO = "22222222-2222-4222-8222-222222222222";
const ALUMNO = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-07-27T10:00:00Z");
const COST: CorrectionCost = { inputTokens: 100, outputTokens: 20, costCents: 3, model: "claude-opus-5" };

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}
function fakeEvents(): EventPublisher {
  return { publish: async () => undefined };
}
function fakeTenant(roles: readonly string[] = ["teacher"], membershipId: string | null = "actor"): TenantContext {
  return {
    schoolId: () => ESCUELA,
    membershipId: () => membershipId,
    roles: () => roles,
    has: (role) => roles.includes(role),
  };
}
function fakeStudentMinor(selfOrGuardianAllowed = true): StudentMinorPort & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    isMinor: async () => false,
    exists: async () => true,
    isSelfOrGuardian: async (params) => {
      calls.push(params);
      return selfOrGuardianAllowed;
    },
  };
}
function fakeClock(): Clock {
  return { now: () => NOW };
}
function fakeLogger(): PinoLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as PinoLogger;
}

function fakeAttemptRepository(previousCount = 0): AttemptRepository & { saved: Attempt[] } {
  const saved: Attempt[] = [];
  return {
    saved,
    find: async (id) => saved.find((a) => a.id.value === id.value) ?? null,
    findOrFail: async (id) => {
      const found = saved.find((a) => a.id.value === id.value);
      if (!found) throw new Error("intento no encontrado");
      return found;
    },
    save: async (attempt) => {
      const index = saved.findIndex((a) => a.id.value === attempt.id.value);
      if (index >= 0) saved[index] = attempt;
      else saved.push(attempt);
    },
    countForExerciseAndStudent: async () => previousCount,
    findAiGradedSubmittedBefore: async () => [],
  };
}

function fakeIds(): IdGenerator {
  let n = 0;
  return { generate: () => `9999999${++n}-9999-4999-8999-999999999999` };
}

const AUTO_GRADABLE_INFO: ExerciseSourceInfo = {
  type: "multiple_choice",
  solution: { correct: 1 },
  rubricId: null,
  rubricCode: null,
  rubricMaxScore: null,
  rubricCriteria: null,
  requiresTeacherValidation: false,
  maxAttempts: 3,
  maxScore: 1,
  language: "es",
  level: "B1",
  task: null,
};

const RUBRIC_INFO: ExerciseSourceInfo = {
  type: "written_production",
  solution: null,
  rubricId: "rubrica-1",
  rubricCode: "mcer-escrita",
  rubricMaxScore: 20,
  rubricCriteria: [
    { key: "adecuacion", label: "Adecuación", weight: 0.5, descriptors: [] },
    { key: "coherencia", label: "Coherencia", weight: 0.5, descriptors: [] },
  ],
  requiresTeacherValidation: true,
  maxAttempts: 3,
  maxScore: 20,
  language: "es",
  level: "B1",
  task: "Escribe una carta.",
};

function buildHandler(params: {
  info: ExerciseSourceInfo | null;
  previousCount?: number;
  corrector?: WritingCorrectorPort;
  roles?: readonly string[];
  membershipId?: string | null;
  studentMinor?: StudentMinorPort & { calls?: unknown[] };
}) {
  const attempts = fakeAttemptRepository(params.previousCount ?? 0);
  const exercises: ExerciseSourcePort = {
    get: async () => params.info,
    getUnits: async () => [],
    getRubricByCode: async () => null,
  };
  const corrector: WritingCorrectorPort = params.corrector ?? {
    correct: async () => {
      throw new Error("no debería llamarse en este doble");
    },
  };
  const studentMinor = params.studentMinor ?? fakeStudentMinor();

  const handler = new SubmitAttemptHandler(
    attempts,
    exercises,
    corrector,
    studentMinor,
    fakeUow(),
    fakeEvents(),
    fakeTenant(params.roles, params.membershipId),
    fakeClock(),
    fakeIds(),
    fakeLogger(),
  );

  return { handler, attempts, studentMinor };
}

describe("SubmitAttemptHandler", () => {
  it("un tipo sin rúbrica se corrige automáticamente y queda ai_graded", async () => {
    const { handler, attempts } = buildHandler({ info: AUTO_GRADABLE_INFO });

    const result = await handler.execute(
      new SubmitAttemptCommand({ exerciseId: EJERCICIO, studentProfileId: ALUMNO, response: { correct: 1 } }),
    );

    expect(result.status).toBe(AttemptStatus.AiGraded);
    const saved = attempts.saved.find((a) => a.id.value === result.attemptId)!;
    expect(saved.aiScore).toBe(1);
    expect(saved.aiModel).toBeNull();
    expect(saved.aiCostCents).toBe(0);
  });

  it("un tipo con rúbrica llama al corrector y pondera la nota final", async () => {
    const corrector: WritingCorrectorPort = {
      correct: async () => ({
        feedback: "Buen trabajo.",
        byCriterion: { adecuacion: 5, coherencia: 3 },
        cost: COST,
      }),
    };
    const { handler, attempts } = buildHandler({ info: RUBRIC_INFO, corrector });

    const result = await handler.execute(
      new SubmitAttemptCommand({
        exerciseId: EJERCICIO,
        studentProfileId: ALUMNO,
        response: { text: "Estimado señor...", wordCount: 90 },
      }),
    );

    expect(result.status).toBe(AttemptStatus.AiGraded);
    const saved = attempts.saved.find((a) => a.id.value === result.attemptId)!;
    // (5*0.5 + 3*0.5) / 5 * 20 = 16
    expect(saved.aiScore).toBe(16);
    expect(saved.aiModel).toBe("claude-opus-5");
    expect(saved.aiCostCents).toBe(3);
  });

  it("un corrector que falla deja el intento en submitted, sin reventar la petición", async () => {
    const corrector: WritingCorrectorPort = {
      correct: async () => {
        throw new Error("MissingAnthropicApiKeyError");
      },
    };
    const { handler, attempts } = buildHandler({ info: RUBRIC_INFO, corrector });

    const result = await handler.execute(
      new SubmitAttemptCommand({
        exerciseId: EJERCICIO,
        studentProfileId: ALUMNO,
        response: { text: "Estimado señor...", wordCount: 90 },
      }),
    );

    expect(result.status).toBe(AttemptStatus.Submitted);
    const saved = attempts.saved.find((a) => a.id.value === result.attemptId)!;
    expect(saved.aiScore).toBeNull();
  });

  it("una respuesta sin texto en un tipo con rúbrica (audio) tampoco llama al corrector", async () => {
    const corrector: WritingCorrectorPort = {
      correct: vi.fn(async () => ({ feedback: "x", byCriterion: {}, cost: COST })),
    };
    const { handler, attempts } = buildHandler({ info: RUBRIC_INFO, corrector });

    const result = await handler.execute(
      new SubmitAttemptCommand({
        exerciseId: EJERCICIO,
        studentProfileId: ALUMNO,
        response: { recordingKey: "audio/clip.mp3" },
      }),
    );

    expect(result.status).toBe(AttemptStatus.Submitted);
    expect(corrector.correct).not.toHaveBeenCalled();
    expect(attempts.saved).toHaveLength(1);
  });

  it("superar el tope de reintentos no persiste ningún intento", async () => {
    const { handler, attempts } = buildHandler({ info: AUTO_GRADABLE_INFO, previousCount: 3 });

    await expect(
      handler.execute(
        new SubmitAttemptCommand({ exerciseId: EJERCICIO, studentProfileId: ALUMNO, response: { correct: 1 } }),
      ),
    ).rejects.toThrow(/máximo 3/);

    expect(attempts.saved).toEqual([]);
  });

  it("un ejercicio que no existe se rechaza sin crear el intento", async () => {
    const { handler, attempts } = buildHandler({ info: null });

    await expect(
      handler.execute(
        new SubmitAttemptCommand({ exerciseId: EJERCICIO, studentProfileId: ALUMNO, response: { correct: 1 } }),
      ),
    ).rejects.toThrow();

    expect(attempts.saved).toEqual([]);
  });

  it("el resultado incluye la nota de la IA, su límite y si exige firma del profesor", async () => {
    const { handler } = buildHandler({ info: AUTO_GRADABLE_INFO });

    const result = await handler.execute(
      new SubmitAttemptCommand({ exerciseId: EJERCICIO, studentProfileId: ALUMNO, response: { correct: 1 } }),
    );

    expect(result.aiScore).toBe(1);
    expect(result.maxScore).toBe(1);
    expect(result.requiresTeacherValidation).toBe(false);
  });

  it("un tipo con rúbrica sin corregir todavía devuelve aiScore null y exige firma", async () => {
    const corrector: WritingCorrectorPort = {
      correct: async () => {
        throw new Error("sin clave");
      },
    };
    const { handler } = buildHandler({ info: RUBRIC_INFO, corrector });

    const result = await handler.execute(
      new SubmitAttemptCommand({
        exerciseId: EJERCICIO,
        studentProfileId: ALUMNO,
        response: { text: "Estimado señor..." },
      }),
    );

    expect(result.aiScore).toBeNull();
    expect(result.requiresTeacherValidation).toBe(true);
  });

  describe("autoservicio del alumno (tarea 12 de la ola 2)", () => {
    it("dirección y profesorado pueden enviar la respuesta de cualquier alumno, sin comprobar nada más", async () => {
      const studentMinor = fakeStudentMinor(false);
      const { handler, studentMinor: used } = buildHandler({
        info: AUTO_GRADABLE_INFO,
        roles: ["teacher"],
        studentMinor,
      });

      await handler.execute(
        new SubmitAttemptCommand({ exerciseId: EJERCICIO, studentProfileId: ALUMNO, response: { correct: 1 } }),
      );

      expect(used.calls).toEqual([]);
    });

    it("el propio alumno puede enviar su respuesta", async () => {
      const { handler, studentMinor } = buildHandler({
        info: AUTO_GRADABLE_INFO,
        roles: ["student"],
        studentMinor: fakeStudentMinor(true),
      });

      const result = await handler.execute(
        new SubmitAttemptCommand({ exerciseId: EJERCICIO, studentProfileId: ALUMNO, response: { correct: 1 } }),
      );

      expect(result.status).toBe(AttemptStatus.AiGraded);
      expect(studentMinor.calls).toEqual([
        { membershipId: "actor", studentId: expect.objectContaining({ value: ALUMNO }) },
      ]);
    });

    it("el tutor legal puede enviar la respuesta de su tutelado", async () => {
      const { handler } = buildHandler({
        info: AUTO_GRADABLE_INFO,
        roles: ["guardian"],
        studentMinor: fakeStudentMinor(true),
      });

      const result = await handler.execute(
        new SubmitAttemptCommand({ exerciseId: EJERCICIO, studentProfileId: ALUMNO, response: { correct: 1 } }),
      );

      expect(result.status).toBe(AttemptStatus.AiGraded);
    });

    it("un alumno que intenta enviar la respuesta de OTRO alumno se rechaza, sin crear el intento", async () => {
      const { handler, attempts } = buildHandler({
        info: AUTO_GRADABLE_INFO,
        roles: ["student"],
        studentMinor: fakeStudentMinor(false),
      });

      await expect(
        handler.execute(
          new SubmitAttemptCommand({ exerciseId: EJERCICIO, studentProfileId: ALUMNO, response: { correct: 1 } }),
        ),
      ).rejects.toBeInstanceOf(AttemptAccessDeniedError);
      expect(attempts.saved).toEqual([]);
    });

    it("sin membresía resuelta (caso defensivo) también se rechaza", async () => {
      const { handler, attempts } = buildHandler({
        info: AUTO_GRADABLE_INFO,
        roles: ["student"],
        membershipId: null,
        studentMinor: fakeStudentMinor(true),
      });

      await expect(
        handler.execute(
          new SubmitAttemptCommand({ exerciseId: EJERCICIO, studentProfileId: ALUMNO, response: { correct: 1 } }),
        ),
      ).rejects.toBeInstanceOf(AttemptAccessDeniedError);
      expect(attempts.saved).toEqual([]);
    });
  });
});
