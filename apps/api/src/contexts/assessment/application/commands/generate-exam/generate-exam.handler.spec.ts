import { randomUUID } from "node:crypto";
import type { PinoLogger } from "nestjs-pino";
import { describe, expect, it, vi } from "vitest";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { EventPublisher } from "../../../../shared/domain/ports/event-publisher.port.js";
import type { IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import type { TenantContext } from "../../../../shared/domain/ports/tenant-context.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { InsufficientCreditsError, ExamSourceUnitNotPublishedError } from "../../../domain/errors/assessment.errors.js";
import type { Exam } from "../../../domain/model/exam.aggregate.js";
import type {
  AiGenerationRepository,
  ExamGenerationLedgerEntry,
} from "../../../domain/ports/ai-generation.repository.port.js";
import type { CreditLedgerPort } from "../../../domain/ports/credit-ledger.port.js";
import type {
  ExamGeneratorPort,
  GeneratedExamItem,
  GenerationCost,
} from "../../../domain/ports/exam-generator.port.js";
import type { ExamRepository } from "../../../domain/ports/exam.repository.port.js";
import type { ExamSourceUnit, ExerciseSourcePort } from "../../../domain/ports/exercise-source.port.js";
import { GenerateExamCommand } from "./generate-exam.command.js";
import { ESTIMATED_CREDITS_RESERVE, GenerateExamHandler } from "./generate-exam.handler.js";

const ESCUELA = "11111111-1111-4111-8111-111111111111";
const ACTOR = "22222222-2222-4222-8222-222222222222";
const ALUMNO_1 = "33333333-3333-4333-8333-333333333333";
const ALUMNO_2 = "44444444-4444-4444-8444-444444444444";
const UNIDAD_1 = "55555555-5555-4555-8555-555555555555";
const UNIDAD_2 = "66666666-6666-4666-8666-666666666666";
const NOW = new Date("2026-07-27T10:00:00Z");

const GENERATION_COST: GenerationCost = { inputTokens: 900, outputTokens: 500, costCents: 24, model: "claude-opus-5" };

const GENERATED_ITEMS: GeneratedExamItem[] = [
  { type: "reading_comprehension", skill: "reading", prompt: { passage: "Un texto largo de sobra.", question: "¿Qué pasa?", options: ["a", "b"] }, solution: { correct: 0 } },
  { type: "cloze", skill: "grammar", prompt: { text: "Ayer {{1}} al mercado.", blanks: [{ id: 1 }], options: ["fui", "voy"] }, solution: { "1": ["fui"] } },
  { type: "multiple_choice", skill: "grammar", prompt: { question: "¿Correcto?", options: ["a", "b"] }, solution: { correct: 0 } },
  { type: "written_production", skill: "writing", prompt: { task: "Escribe una carta.", minWords: 50, maxWords: 100 } },
  { type: "spoken_production", skill: "speaking", prompt: { task: "Describe tu ciudad.", durationSeconds: 60 } },
];

function fakeCreditLedger(params: { balance: number; hardLimit?: boolean }) {
  const state = {
    balance: params.balance,
    hardLimit: params.hardLimit ?? true,
    movements: [] as Array<{ kind: "spend" | "refund"; credits: number }>,
  };
  const port: CreditLedgerPort = {
    spend: async ({ credits }) => {
      const newBalance = state.balance - credits;
      if (state.hardLimit && newBalance < 0) {
        throw new InsufficientCreditsError(ESCUELA, credits, state.balance);
      }
      state.balance = newBalance;
      state.movements.push({ kind: "spend", credits });
    },
    refund: async ({ credits }) => {
      state.balance += credits;
      state.movements.push({ kind: "refund", credits });
    },
  };
  return { port, state };
}

function fakeExerciseSource(overrides?: { units?: ExamSourceUnit[] }): ExerciseSourcePort {
  const units: ExamSourceUnit[] =
    overrides?.units ?? [
      { id: UNIDAD_1, language: "es", level: "B1", status: "published", topic: "En la consulta del médico", exercises: [{ id: "ex-1", type: "multiple_choice", skill: "grammar", prompt: { question: "¿Ya usado?", options: ["x", "y"] } }] },
      { id: UNIDAD_2, language: "es", level: "B1", status: "published", topic: "De compras", exercises: [] },
    ];
  return {
    get: async () => null,
    getUnits: async () => units,
    getRubricByCode: async (code) => ({ id: `rubric-${code}`, maxScore: 20, criteria: [{ key: "c1", label: "Criterio", weight: 1, descriptors: ["a"] }] }),
  };
}

function fakeExamRepository() {
  const saved: Exam[] = [];
  const repository: ExamRepository = {
    save: async (exam) => {
      const index = saved.findIndex((e) => e.id.value === exam.id.value);
      if (index >= 0) saved[index] = exam;
      else saved.push(exam);
    },
    findById: async (id) => saved.find((e) => e.id.value === id.value) ?? null,
    findOrFail: async (id) => {
      const found = saved.find((e) => e.id.value === id.value);
      if (!found) throw new Error("not found");
      return found;
    },
  };
  return { repository, saved };
}

function fakeAiGenerationRepository() {
  const entries: ExamGenerationLedgerEntry[] = [];
  const repository: AiGenerationRepository = { record: async (entry) => void entries.push(entry) };
  return { repository, entries };
}

function fakeGenerator(overrides?: { generateItems?: ExamGeneratorPort["generateItems"] }) {
  const generateItemsSpy = vi.fn(
    overrides?.generateItems ?? (async () => ({ items: GENERATED_ITEMS, cost: GENERATION_COST })),
  );
  const generator: ExamGeneratorPort = { generateItems: generateItemsSpy };
  return { generator, generateItemsSpy };
}

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}
function fakeEvents(): EventPublisher {
  return { publish: async () => undefined };
}
function fakeTenant(): TenantContext {
  return { schoolId: () => ESCUELA, membershipId: () => ACTOR, roles: () => ["owner"], has: () => true };
}
function fakeClock(): Clock {
  return { now: () => NOW };
}
function fakeIds(): IdGenerator {
  return { generate: () => randomUUID() };
}
function fakeLogger(): PinoLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as PinoLogger;
}

function buildHandler(params: {
  balance: number;
  hardLimit?: boolean;
  units?: ExamSourceUnit[];
  generatorOverrides?: Parameters<typeof fakeGenerator>[0];
}) {
  const credits = fakeCreditLedger({ balance: params.balance, hardLimit: params.hardLimit });
  const exams = fakeExamRepository();
  const aiGenerations = fakeAiGenerationRepository();
  const exerciseSource = fakeExerciseSource({ units: params.units });
  const gen = fakeGenerator(params.generatorOverrides);

  const handler = new GenerateExamHandler(
    exams.repository,
    exerciseSource,
    aiGenerations.repository,
    credits.port,
    gen.generator,
    fakeUow(),
    fakeEvents(),
    fakeTenant(),
    fakeClock(),
    fakeIds(),
    fakeLogger(),
  );

  return { handler, credits, exams, aiGenerations, gen };
}

const COMMAND_PROPS = {
  kind: "unit_exam" as const,
  studentProfileIds: [ALUMNO_1, ALUMNO_2],
  title: "Examen B1 — unidades 1 y 2",
  language: "es",
  level: "B1",
  sourceContentUnitIds: [UNIDAD_1, UNIDAD_2],
  durationMinutes: 90,
};

describe("GenerateExamHandler", () => {
  it("paso 1: caso feliz — genera el MISMO examen una vez por alumno del grupo", async () => {
    const { handler, credits, exams, aiGenerations, gen } = buildHandler({ balance: 100 });

    const result = await handler.execute(new GenerateExamCommand(COMMAND_PROPS));

    expect(result.status).toBe("scheduled");
    expect(result.examIds).toHaveLength(2);
    expect(gen.generateItemsSpy).toHaveBeenCalledTimes(1); // una sola llamada, reutilizada para todo el grupo

    expect(exams.saved).toHaveLength(2);
    const studentIds = exams.saved.map((e) => e.studentProfileId).sort();
    expect(studentIds).toEqual([ALUMNO_1, ALUMNO_2].sort());

    // El mismo «papel»: mismas secciones/ítems para los dos alumnos.
    const [examA, examB] = exams.saved;
    expect(examA!.sections.map((s) => s.skill).sort()).toEqual(examB!.sections.map((s) => s.skill).sort());

    expect(aiGenerations.entries).toHaveLength(1);
    expect(aiGenerations.entries[0]!.status).toBe("succeeded");

    // Reserva de 15, coste real 24 céntimos → 2 créditos: se cobra la diferencia.
    expect(credits.state.balance).toBe(100 - 2);
  });

  it("paso 2: sin créditos (tope duro) se rechaza sin llamar al modelo", async () => {
    const { handler, gen, exams } = buildHandler({ balance: 0, hardLimit: true });

    await expect(handler.execute(new GenerateExamCommand(COMMAND_PROPS))).rejects.toBeInstanceOf(
      InsufficientCreditsError,
    );
    expect(gen.generateItemsSpy).not.toHaveBeenCalled();
    expect(exams.saved).toEqual([]);
  });

  it("rechaza generar un examen de una unidad en borrador, antes de reservar ningún crédito", async () => {
    const { handler, credits, gen } = buildHandler({
      balance: 100,
      units: [
        { id: UNIDAD_1, language: "es", level: "B1", status: "published", topic: "A", exercises: [] },
        { id: UNIDAD_2, language: "es", level: "B1", status: "draft", topic: "B", exercises: [] },
      ],
    });

    await expect(handler.execute(new GenerateExamCommand(COMMAND_PROPS))).rejects.toBeInstanceOf(
      ExamSourceUnitNotPublishedError,
    );
    expect(credits.state.balance).toBe(100);
    expect(gen.generateItemsSpy).not.toHaveBeenCalled();
  });

  it("paso 3: un fallo de generación devuelve la reserva entera y no guarda ningún examen", async () => {
    const failing: ExamGeneratorPort["generateItems"] = async () => {
      const error = new Error("La generación no produjo una salida válida tras 2 intentos.") as Error & {
        cost: GenerationCost;
      };
      error.cost = GENERATION_COST;
      throw error;
    };
    const { handler, credits, exams, aiGenerations } = buildHandler({
      balance: 100,
      generatorOverrides: { generateItems: failing },
    });

    await expect(handler.execute(new GenerateExamCommand(COMMAND_PROPS))).rejects.toThrow(/no se pudo completar/i);

    expect(exams.saved).toEqual([]);
    expect(credits.state.balance).toBe(100);
    expect(aiGenerations.entries).toHaveLength(1);
    expect(aiGenerations.entries[0]!.status).toBe("failed");
    expect(aiGenerations.entries[0]!.creditsCharged).toBe(0);
  });

  it("verificación (paso 7): ningún ítem generado es idéntico a un ejercicio de práctica ya existente", async () => {
    const prompt = { question: "¿Ya usado?", options: ["x", "y"] };
    const { handler } = buildHandler({
      balance: 100,
      units: [
        { id: UNIDAD_1, language: "es", level: "B1", status: "published", topic: "A", exercises: [{ id: "ex-1", type: "multiple_choice", skill: "grammar", prompt }] },
      ],
      generatorOverrides: {
        generateItems: async () => ({
          items: [{ type: "multiple_choice", skill: "grammar", prompt, solution: { correct: 0 } }],
          cost: GENERATION_COST,
        }),
      },
    });

    await expect(
      handler.execute(new GenerateExamCommand({ ...COMMAND_PROPS, sourceContentUnitIds: [UNIDAD_1] })),
    ).rejects.toThrow(/copia literal/);
  });
});
