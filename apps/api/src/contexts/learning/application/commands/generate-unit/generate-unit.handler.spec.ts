import { randomUUID } from "node:crypto";
import type { PinoLogger } from "nestjs-pino";
import { describe, expect, it, vi } from "vitest";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { EventPublisher } from "../../../../shared/domain/ports/event-publisher.port.js";
import type { IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import type { TenantContext } from "../../../../shared/domain/ports/tenant-context.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import type { ContentUnit } from "../../../domain/model/content-unit.aggregate.js";
import type { Exercise } from "../../../domain/model/exercise.entity.js";
import { InsufficientCreditsError } from "../../../domain/errors/learning.errors.js";
import type {
  AiGenerationRepository,
  GenerationLedgerEntry,
} from "../../../domain/ports/ai-generation.repository.port.js";
import type { ContentGeneratorPort, GenerationCost } from "../../../domain/ports/content-generator.port.js";
import type {
  ContentUnitRepository,
  ContentUnitTranslation,
} from "../../../domain/ports/content-unit.repository.port.js";
import type { CreditLedgerPort } from "../../../domain/ports/credit-ledger.port.js";
import { GenerateUnitCommand } from "./generate-unit.command.js";
import { ESTIMATED_CREDITS_RESERVE, GenerateUnitHandler } from "./generate-unit.handler.js";

const ESCUELA = "11111111-1111-4111-8111-111111111111";
const ACTOR = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-07-27T10:00:00Z");

const UNIT_COST: GenerationCost = { inputTokens: 4000, outputTokens: 2000, costCents: 94, model: "claude-opus-5" };
const EXERCISES_COST: GenerationCost = { inputTokens: 1500, outputTokens: 600, costCents: 46, model: "claude-opus-5" };

/** Un doble mínimo pero realista del saldo: reproduce el `ai_hard_limit` de `CreditBalance.spend()` (billing, tarea 5) sin importar nada de ese contexto. */
function fakeCreditLedger(params: { balance: number; hardLimit?: boolean }) {
  const state = {
    balance: params.balance,
    hardLimit: params.hardLimit ?? true,
    movements: [] as Array<{ kind: "spend" | "refund"; credits: number; note: string }>,
  };
  const port: CreditLedgerPort = {
    spend: async ({ credits, note }) => {
      const newBalance = state.balance - credits;
      if (state.hardLimit && newBalance < 0) {
        throw new InsufficientCreditsError(ESCUELA, credits, state.balance);
      }
      state.balance = newBalance;
      state.movements.push({ kind: "spend", credits, note });
    },
    refund: async ({ credits, note }) => {
      state.balance += credits;
      state.movements.push({ kind: "refund", credits, note });
    },
  };
  return { port, state };
}

function fakeContentUnitRepository() {
  const saved: ContentUnit[] = [];
  const exercisesByUnit = new Map<string, Exercise[]>();
  const translations: ContentUnitTranslation[] = [];
  const repository: ContentUnitRepository = {
    save: async (unit) => {
      const index = saved.findIndex((u) => u.id.value === unit.id.value);
      if (index >= 0) saved[index] = unit;
      else saved.push(unit);
    },
    saveTranslation: async (_unit, translation) => {
      translations.push(translation);
    },
    addExercises: async (unit, exercises) => {
      exercisesByUnit.set(unit.id.value, [...exercises]);
    },
    findById: async () => null,
    findRubricIdByCode: async (code) => ({ id: `rubric-${code}`, maxScore: 20 }),
    // Tarea 9 (repetición espaciada), ajena a este manejador: no se ejercita aquí.
    findExerciseSrsInfo: async () => null,
  };
  return { repository, saved, exercisesByUnit, translations };
}

function fakeAiGenerationRepository() {
  const entries: GenerationLedgerEntry[] = [];
  const repository: AiGenerationRepository = { record: async (entry) => void entries.push(entry) };
  return { repository, entries };
}

function fakeGenerator(overrides?: {
  generateUnit?: ContentGeneratorPort["generateUnit"];
  generateExercises?: ContentGeneratorPort["generateExercises"];
}) {
  const generateUnitSpy = vi.fn(
    overrides?.generateUnit ??
      (async () => ({
        title: "En la consulta del médico",
        description: "Vocabulario y expresiones para una cita médica.",
        body: "El paciente entra en la consulta y saluda al médico...",
        cost: UNIT_COST,
      })),
  );
  const generateExercisesSpy = vi.fn(
    overrides?.generateExercises ??
      (async () => ({
        exercises: [
          { type: "multiple_choice", prompt: { question: "¿Qué le pasa?", options: ["Gripe", "Nada"] }, solution: { correct: 0 } },
          {
            type: "matching",
            prompt: { left: ["la receta", "la sala de espera"], right: ["papel con el medicamento", "donde esperas"] },
            solution: { pairs: [[0, 0], [1, 1]] },
          },
        ],
        cost: EXERCISES_COST,
      })),
  );
  const generator: ContentGeneratorPort = {
    generateUnit: generateUnitSpy,
    generateExercises: generateExercisesSpy,
    correctWriting: vi.fn(async () => {
      throw new Error("no debería llamarse en este doble");
    }),
  };
  return { generator, generateUnitSpy, generateExercisesSpy };
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
  generatorOverrides?: Parameters<typeof fakeGenerator>[0];
}) {
  const credits = fakeCreditLedger({ balance: params.balance, hardLimit: params.hardLimit });
  const contentUnits = fakeContentUnitRepository();
  const aiGenerations = fakeAiGenerationRepository();
  const gen = fakeGenerator(params.generatorOverrides);

  const handler = new GenerateUnitHandler(
    contentUnits.repository,
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

  return { handler, credits, contentUnits, aiGenerations, gen };
}

const COMMAND_PROPS = {
  code: "ES-B1-U07",
  language: "es",
  level: "B1",
  topic: "En la consulta del médico",
  skills: ["listening", "vocabulary"],
  primaryLocale: "es-ES",
  exerciseTypes: ["multiple_choice", "matching"],
};

describe("GenerateUnitHandler", () => {
  it("paso 1: caso feliz — reserva, genera, persiste en `in_review` y ajusta el crédito sobrante", async () => {
    const { handler, credits, contentUnits, aiGenerations, gen } = buildHandler({ balance: 100 });

    const result = await handler.execute(new GenerateUnitCommand(COMMAND_PROPS));

    expect(result.status).toBe("in_review");
    expect(gen.generateUnitSpy).toHaveBeenCalledTimes(1);
    expect(gen.generateExercisesSpy).toHaveBeenCalledTimes(1);

    const saved = contentUnits.saved.find((u) => u.id.value === result.contentUnitId);
    expect(saved).toBeDefined();
    expect(saved!.exerciseIds).toHaveLength(2);
    expect(saved!.generationCostCents).toBe(UNIT_COST.costCents + EXERCISES_COST.costCents);

    // Coste real: 94 + 46 = 140 céntimos → 9 + 5 = 14 créditos (redondeo por llamada, no del total).
    expect(saved!.creditsSpent).toBe(14);

    // Dos filas de `ai_generations`, una por llamada real al modelo.
    expect(aiGenerations.entries).toHaveLength(2);
    expect(aiGenerations.entries.map((e) => e.kind).sort()).toEqual(["exercise_set", "unit_body"]);
    expect(aiGenerations.entries.every((e) => e.status === "succeeded")).toBe(true);

    // Reserva de 40, coste real de 14 → se devuelve la diferencia (26).
    expect(credits.state.balance).toBe(100 - 14);
    const refunds = credits.state.movements.filter((m) => m.kind === "refund");
    expect(refunds).toHaveLength(1);
    expect(refunds[0]!.credits).toBe(ESTIMATED_CREDITS_RESERVE - 14);
  });

  it("paso 2: sin créditos (tope duro, saldo cero) se rechaza sin llamar al modelo", async () => {
    const { handler, gen, contentUnits } = buildHandler({ balance: 0, hardLimit: true });

    await expect(handler.execute(new GenerateUnitCommand(COMMAND_PROPS))).rejects.toBeInstanceOf(
      InsufficientCreditsError,
    );

    expect(gen.generateUnitSpy).not.toHaveBeenCalled();
    expect(gen.generateExercisesSpy).not.toHaveBeenCalled();
    expect(contentUnits.saved).toEqual([]);
  });

  it("paso 3: un fallo a mitad (generar ejercicios) devuelve toda la reserva y no deja nada a medias", async () => {
    const failingGenerateExercises: ContentGeneratorPort["generateExercises"] = async () => {
      const error = new Error("La generación no produjo una salida válida tras 2 intentos.") as Error & {
        cost: GenerationCost;
      };
      error.cost = EXERCISES_COST;
      throw error;
    };
    const { handler, credits, contentUnits, aiGenerations } = buildHandler({
      balance: 100,
      generatorOverrides: { generateExercises: failingGenerateExercises },
    });

    await expect(handler.execute(new GenerateUnitCommand(COMMAND_PROPS))).rejects.toThrow(
      /no se pudo generar/i,
    );

    // Nada de la unidad ni de los ejercicios queda persistido.
    expect(contentUnits.saved).toEqual([]);
    expect(contentUnits.exercisesByUnit.size).toBe(0);

    // El saldo vuelve exactamente a donde estaba: la reserva completa se devuelve.
    expect(credits.state.balance).toBe(100);
    const refunds = credits.state.movements.filter((m) => m.kind === "refund");
    expect(refunds).toHaveLength(1);
    expect(refunds[0]!.credits).toBe(ESTIMATED_CREDITS_RESERVE);

    // Se registra lo que de verdad se llegó a llamar: `unit_body` (con éxito,
    // sí costó) y `exercise_set` (con el coste del intento fallido), las dos
    // sin cobrar crédito — se devolvió todo.
    expect(aiGenerations.entries).toHaveLength(2);
    const unitBody = aiGenerations.entries.find((e) => e.kind === "unit_body")!;
    const exerciseSet = aiGenerations.entries.find((e) => e.kind === "exercise_set")!;
    expect(unitBody.status).toBe("succeeded");
    expect(unitBody.creditsCharged).toBe(0);
    expect(exerciseSet.status).toBe("failed");
    expect(exerciseSet.costCents).toBe(EXERCISES_COST.costCents);
    expect(exerciseSet.creditsCharged).toBe(0);
  });

  it("un tipo de ejercicio que exige audio se rechaza antes de reservar ningún crédito (sin proveedor de audio conectado aún)", async () => {
    const { handler, credits, gen } = buildHandler({ balance: 100 });

    await expect(
      handler.execute(
        new GenerateUnitCommand({ ...COMMAND_PROPS, exerciseTypes: ["listening_comprehension"] }),
      ),
    ).rejects.toThrow(/audio/i);

    expect(credits.state.balance).toBe(100); // nada se reservó
    expect(gen.generateUnitSpy).not.toHaveBeenCalled();
  });
});
