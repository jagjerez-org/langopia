import { AsyncLocalStorage } from "node:async_hooks";
import { ClsService } from "nestjs-cls";
import { describe, expect, it } from "vitest";
import type { Clock } from "../../../shared/domain/ports/clock.port.js";
import type { EventPublisher } from "../../../shared/domain/ports/event-publisher.port.js";
import type { UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { Attempt, AttemptStatus } from "../../domain/model/attempt.aggregate.js";
import type { AttemptRepository } from "../../domain/ports/attempt.repository.port.js";
import type { ExerciseSourceInfo, ExerciseSourcePort } from "../../domain/ports/exercise-source.port.js";
import type { SchoolDirectoryPort } from "../../domain/ports/school-directory.port.js";
import { AttemptId, ExerciseId } from "../../domain/model/identifiers.js";
import { NotifyOverdueAttemptsJob } from "./notify-overdue-attempts.job.js";

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-07-27T10:00:00Z");

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeLogger() {
  return { info: () => undefined, warn: () => undefined, error: () => undefined };
}

function exerciseInfo(overrides: Partial<ExerciseSourceInfo> = {}): ExerciseSourceInfo {
  return {
    type: "written_production",
    solution: null,
    rubricId: "rubrica-1",
    rubricCode: "mcer-escrita",
    rubricMaxScore: 20,
    rubricCriteria: [],
    requiresTeacherValidation: true,
    maxAttempts: 3,
    maxScore: 20,
    language: "es",
    level: "B1",
    task: "Escribe una carta.",
    ...overrides,
  };
}

function attemptAiGraded(id: string, exerciseId: string, submittedAt: Date): Attempt {
  return Attempt.rehydrate({
    id: AttemptId.of(id),
    schoolId: SchoolId.of(SCHOOL_ID),
    exerciseId: ExerciseId.of(exerciseId),
    studentProfileId: "33333333-3333-4333-8333-333333333333",
    sessionId: null,
    assessmentId: null,
    attemptNumber: 1,
    response: { text: "..." },
    status: AttemptStatus.AiGraded,
    aiScore: 10,
    aiFeedback: "x",
    aiRubricScores: null,
    aiModel: "claude-opus-5",
    aiCostCents: 3,
    teacherScore: null,
    teacherFeedback: null,
    validatedByMembershipId: null,
    validatedAt: null,
    startedAt: null,
    submittedAt,
    durationMs: null,
  });
}

function buildJob(params: { overdue: Attempt[]; infoByExercise: Record<string, ExerciseSourceInfo | null> }) {
  const published: unknown[] = [];
  const cutoffCalls: Date[] = [];

  const cls = new ClsService(new AsyncLocalStorage());
  const schools: SchoolDirectoryPort = { allIds: async () => [SCHOOL_ID] };
  const attempts: AttemptRepository = {
    find: async () => null,
    findOrFail: async () => {
      throw new Error("no usado en este trabajo");
    },
    save: async () => undefined,
    countForExerciseAndStudent: async () => 0,
    findAiGradedSubmittedBefore: async (cutoff) => {
      cutoffCalls.push(cutoff);
      return params.overdue;
    },
  };
  const exercises: ExerciseSourcePort = {
    get: async (exerciseId) => params.infoByExercise[exerciseId.value] ?? null,
    getUnits: async () => [],
    getRubricByCode: async () => null,
  };
  const events: EventPublisher = {
    publish: async (evts) => {
      published.push(...evts);
    },
  };
  const clock: Clock = { now: () => NOW };

  const job = new NotifyOverdueAttemptsJob(
    cls,
    fakeUow(),
    schools,
    attempts,
    exercises,
    events,
    clock,
    fakeLogger() as never,
  );

  return { job, published, cutoffCalls };
}

describe("NotifyOverdueAttemptsJob (paso 6 del brief: aviso a los 7 días)", () => {
  it("pide al repositorio los intentos ai_graded anteriores a hoy menos 7 días", async () => {
    const { job, cutoffCalls } = buildJob({ overdue: [], infoByExercise: {} });
    await job.run();
    expect(cutoffCalls).toEqual([new Date("2026-07-20T10:00:00Z")]);
  });

  it("avisa de un intento ai_graded cuyo ejercicio exige validación del profesor", async () => {
    const exerciseId = "22222222-2222-4222-8222-222222222222";
    const attempt = attemptAiGraded(
      "44444444-4444-4444-8444-444444444444",
      exerciseId,
      new Date("2026-07-10T00:00:00Z"),
    );
    const { job, published } = buildJob({
      overdue: [attempt],
      infoByExercise: { [exerciseId]: exerciseInfo({ requiresTeacherValidation: true }) },
    });

    await job.run();

    expect(published).toHaveLength(1);
    expect((published[0] as { eventName: string }).eventName).toBe(
      "assessment.attempt.validation_overdue",
    );
  });

  it("no avisa de un ejercicio que no exige validación del profesor", async () => {
    const exerciseId = "22222222-2222-4222-8222-222222222222";
    const attempt = attemptAiGraded(
      "44444444-4444-4444-8444-444444444444",
      exerciseId,
      new Date("2026-07-10T00:00:00Z"),
    );
    const { job, published } = buildJob({
      overdue: [attempt],
      infoByExercise: { [exerciseId]: exerciseInfo({ requiresTeacherValidation: false }) },
    });

    await job.run();

    expect(published).toEqual([]);
  });

  it("no avisa nada si no hay intentos vencidos", async () => {
    const { job, published } = buildJob({ overdue: [], infoByExercise: {} });
    await job.run();
    expect(published).toEqual([]);
  });
});
