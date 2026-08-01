import type { PinoLogger } from "nestjs-pino";
import { describe, expect, it, vi } from "vitest";
import { CefrLevel } from "../../../../shared/domain/model/cefr-level.js";
import { SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { EventPublisher } from "../../../../shared/domain/ports/event-publisher.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { Exam, type ExamItem, type ExamSection } from "../../../domain/model/exam.aggregate.js";
import { ExamId } from "../../../domain/model/identifiers.js";
import type { ExamRepository } from "../../../domain/ports/exam.repository.port.js";
import type { ExerciseSourcePort } from "../../../domain/ports/exercise-source.port.js";
import type { WritingCorrectorPort } from "../../../domain/ports/writing-corrector.port.js";
import { GradeExamCommand } from "./grade-exam.command.js";
import { GradeExamHandler } from "./grade-exam.handler.js";

const ESCUELA = SchoolId.of("11111111-1111-4111-8111-111111111111");
const ALUMNO = "22222222-2222-4222-8222-222222222222";
const UNIDAD = "33333333-3333-4333-8333-333333333333";
const AHORA = new Date("2026-07-27T10:00:00Z");

function item(overrides: Partial<ExamItem>): ExamItem {
  return {
    id: overrides.id ?? "item-1",
    sourceExerciseId: null,
    sourceContentUnitId: UNIDAD,
    type: "multiple_choice",
    skill: "grammar",
    level: "B1",
    prompt: { question: "¿Correcto?", options: ["a", "b"] },
    solution: { correct: 0 },
    rubricId: null,
    rubricCode: null,
    maxScore: 1,
    response: null,
    result: null,
    ...overrides,
  };
}

function buildExam(items: ExamItem[]): Exam {
  const bySkill = new Map<string, ExamItem[]>();
  for (const it of items) {
    const list = bySkill.get(it.skill) ?? [];
    list.push(it);
    bySkill.set(it.skill, list);
  }
  const sections: ExamSection[] = [...bySkill.entries()].map(([skill, sectionItems]) => ({
    skill,
    durationMinutes: 20,
    items: sectionItems,
  }));

  const exam = Exam.generate({
    id: ExamId.of("44444444-4444-4444-8444-444444444444"),
    schoolId: ESCUELA,
    kind: "unit_exam",
    studentProfileId: ALUMNO,
    title: "Examen de prueba",
    language: "es",
    level: CefrLevel.B1,
    sourceUnits: [{ id: UNIDAD, status: "published" }],
    skillDistribution: { grammar: 50, writing: 50 },
    sections,
    durationMinutes: 60,
    now: AHORA,
  });
  exam.start({ now: AHORA });
  const responses = Object.fromEntries(items.filter((i) => i.response).map((i) => [i.id, i.response!]));
  exam.submit({ responses, now: AHORA });
  exam.pullDomainEvents();
  return exam;
}

function fakeExamRepository(exam: Exam) {
  const state = { exam };
  const repository: ExamRepository = {
    save: async (e) => {
      state.exam = e;
    },
    findById: async () => state.exam,
    findOrFail: async () => state.exam,
  };
  return { repository, state };
}

function fakeExerciseSource(): ExerciseSourcePort {
  return {
    get: async () => null,
    getUnits: async () => [],
    getRubricByCode: async (code) => ({
      id: `rubric-${code}`,
      maxScore: 20,
      criteria: [{ key: "adecuacion", label: "Adecuación", weight: 1, descriptors: ["a"] }],
    }),
  };
}

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}
function fakeEvents(): EventPublisher {
  return { publish: async () => undefined };
}
function fakeClock(): Clock {
  return { now: () => AHORA };
}
function fakeLogger(): PinoLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as PinoLogger;
}

describe("GradeExamHandler", () => {
  it("corrige automáticamente los ítems con `solution`, sin llamar al corrector de IA", async () => {
    const exam = buildExam([
      item({ id: "i1", type: "multiple_choice", skill: "grammar", solution: { correct: 0 }, response: { correct: 0 }, maxScore: 1 }),
    ]);
    const exams = fakeExamRepository(exam);
    const corrector: WritingCorrectorPort = {
      correct: vi.fn(async () => {
        throw new Error("no debería llamarse en este doble");
      }),
    };
    const handler = new GradeExamHandler(exams.repository, fakeExerciseSource(), corrector, fakeUow(), fakeEvents(), fakeClock(), fakeLogger());

    const result = await handler.execute(new GradeExamCommand({ examId: exam.id.value }));

    expect(result.status).toBe("ai_graded");
    expect(result.score).toBe(1);
    expect(corrector.correct).not.toHaveBeenCalled();
  });

  it("corrige por rúbrica los ítems con texto real, reutilizando `Rubric.weightedScore`", async () => {
    const exam = buildExam([
      item({
        id: "i2",
        type: "written_production",
        skill: "writing",
        solution: null,
        rubricId: "rubric-1",
        rubricCode: "mcer-escrita",
        maxScore: 20,
        prompt: { task: "Escribe una carta.", minWords: 50, maxWords: 100 },
        response: { text: "Querido amigo, ..." },
      }),
    ]);
    const exams = fakeExamRepository(exam);
    const corrector: WritingCorrectorPort = {
      correct: vi.fn(async () => ({
        feedback: "Buen texto.",
        byCriterion: { adecuacion: 4 },
        cost: { inputTokens: 200, outputTokens: 100, costCents: 5, model: "claude-opus-5" },
      })),
    };
    const handler = new GradeExamHandler(exams.repository, fakeExerciseSource(), corrector, fakeUow(), fakeEvents(), fakeClock(), fakeLogger());

    const result = await handler.execute(new GradeExamCommand({ examId: exam.id.value }));

    expect(result.status).toBe("ai_graded");
    expect(result.score).toBe(16); // 4/5 * 20
    expect(corrector.correct).toHaveBeenCalledTimes(1);
  });

  it("un ítem sin respuesta no se corrige y no rompe el flujo", async () => {
    const exam = buildExam([
      item({ id: "i1", response: { correct: 0 }, maxScore: 1 }),
      item({ id: "i3", skill: "reading", response: null, maxScore: 1 }),
    ]);
    const exams = fakeExamRepository(exam);
    const corrector: WritingCorrectorPort = { correct: vi.fn(async () => { throw new Error("no llamar"); }) };
    const handler = new GradeExamHandler(exams.repository, fakeExerciseSource(), corrector, fakeUow(), fakeEvents(), fakeClock(), fakeLogger());

    const result = await handler.execute(new GradeExamCommand({ examId: exam.id.value }));

    expect(result.status).toBe("ai_graded");
    expect(result.score).toBe(1); // solo el ítem respondido cuenta
  });

  it("si el corrector de IA falla (p. ej. sin ANTHROPIC_API_KEY), el ítem de rúbrica queda sin resultado, sin romper la corrección", async () => {
    const exam = buildExam([
      item({
        id: "i2",
        type: "written_production",
        skill: "writing",
        solution: null,
        rubricId: "rubric-1",
        rubricCode: "mcer-escrita",
        maxScore: 20,
        response: { text: "Texto." },
      }),
      item({ id: "i1", response: { correct: 0 }, maxScore: 1 }),
    ]);
    const exams = fakeExamRepository(exam);
    const corrector: WritingCorrectorPort = {
      correct: vi.fn(async () => {
        throw new Error("Falta ANTHROPIC_API_KEY.");
      }),
    };
    const handler = new GradeExamHandler(exams.repository, fakeExerciseSource(), corrector, fakeUow(), fakeEvents(), fakeClock(), fakeLogger());

    const result = await handler.execute(new GradeExamCommand({ examId: exam.id.value }));

    // La IA propone lo que puede; lo que no puede, el profesor lo valida
    // directamente — el intento de corrección no bloquea el resto.
    expect(result.status).toBe("ai_graded");
    expect(result.score).toBe(1); // solo el ítem automático
  });
});
