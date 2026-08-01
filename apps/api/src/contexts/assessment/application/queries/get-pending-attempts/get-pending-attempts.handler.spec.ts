import { describe, expect, it } from "vitest";
import type {
  AssessmentReadModel,
  PendingAttemptEntry,
} from "../../ports/assessment-read-model.port.js";
import { GetPendingAttemptsHandler, MAX_PENDING_ATTEMPTS } from "./get-pending-attempts.handler.js";

const INTENTO: PendingAttemptEntry = {
  attemptId: "11111111-1111-4111-8111-111111111111",
  exerciseId: "22222222-2222-4222-8222-222222222222",
  exerciseType: "written_production",
  skill: "writing",
  prompt: { task: "Escribe una carta al médico", minWords: 80, maxWords: 120, register: "formal" },
  response: { text: "Estimado doctor..." },
  maxScore: 20,
  studentProfileId: "33333333-3333-4333-8333-333333333333",
  studentName: "Paula Vidal",
  status: "ai_graded",
  attemptNumber: 1,
  aiScore: 14,
  aiFeedback: "Buena estructura; revisa la concordancia.",
  submittedAt: "2026-07-27T09:00:00.000Z",
};

function fakeReadModel(entries: PendingAttemptEntry[]): AssessmentReadModel & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    studentsWithoutRecentEvaluation: async () => {
      throw new Error("no debería llamarse en este doble");
    },
    pendingValidation: async (params) => {
      calls.push(params);
      return entries;
    },
  };
}

describe("GetPendingAttemptsHandler", () => {
  it("devuelve la bandeja tal como la da el modelo de lectura, sin reordenar ni filtrar", async () => {
    const readModel = fakeReadModel([INTENTO]);
    const handler = new GetPendingAttemptsHandler(readModel);

    const result = await handler.execute();

    expect(result).toEqual([INTENTO]);
  });

  it("acota la bandeja a una sesión de corrección abarcable", async () => {
    const readModel = fakeReadModel([]);
    const handler = new GetPendingAttemptsHandler(readModel);

    await handler.execute();

    expect(readModel.calls).toEqual([{ limit: MAX_PENDING_ATTEMPTS }]);
  });

  it("una bandeja vacía es una bandeja vacía, no un error", async () => {
    const handler = new GetPendingAttemptsHandler(fakeReadModel([]));

    await expect(handler.execute()).resolves.toEqual([]);
  });
});
