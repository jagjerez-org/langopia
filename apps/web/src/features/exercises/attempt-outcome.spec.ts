import { describe, expect, it } from "vitest";
import { describeAttemptOutcome } from "./attempt-outcome.js";
import type { SubmitAttemptResult } from "./types.js";

function result(overrides: Partial<SubmitAttemptResult> = {}): SubmitAttemptResult {
  return {
    attemptId: "11111111-1111-1111-1111-111111111111",
    status: "ai_graded",
    aiScore: 2,
    aiFeedback: "2 de 2 respuesta(s) correcta(s).",
    maxScore: 2,
    requiresTeacherValidation: false,
    ...overrides,
  };
}

describe("describeAttemptOutcome (Paso 3: corrección inmediata frente a pendiente de revisión)", () => {
  it("tipo automático ya corregido: el alumno ve su nota al momento", () => {
    expect(describeAttemptOutcome(result())).toEqual({
      kind: "corrected",
      score: 2,
      maxScore: 2,
      feedback: "2 de 2 respuesta(s) correcta(s).",
    });
  });

  it("tipo de rúbrica: pendiente de revisión aunque la IA ya haya puesto nota", () => {
    const outcome = describeAttemptOutcome(
      result({ requiresTeacherValidation: true, aiScore: 16, maxScore: 20, aiFeedback: "Registro adecuado." }),
    );

    expect(outcome).toEqual({
      kind: "pending_review",
      proposedScore: 16,
      maxScore: 20,
      feedback: "Registro adecuado.",
    });
  });

  it("sin corrección automática (el intento se queda en `submitted`), también falta el profesor", () => {
    expect(
      describeAttemptOutcome(result({ status: "submitted", aiScore: null, aiFeedback: null })),
    ).toEqual({ kind: "pending_review", proposedScore: null, maxScore: 2, feedback: null });
  });

  it("una nota de 0 sigue siendo una corrección, no una ausencia de corrección", () => {
    // `aiScore: 0` es falsy: comprobarlo con `if (result.aiScore)` en vez de
    // con `!== null` habría enseñado «pendiente de revisión» a quien lo falló
    // todo, escondiéndole su corrección.
    expect(describeAttemptOutcome(result({ aiScore: 0 })).kind).toBe("corrected");
  });

  it("no deduce del tipo quién lleva rúbrica: solo mira `requiresTeacherValidation`", () => {
    // Mismo resultado en todo salvo la bandera que manda la API.
    expect(describeAttemptOutcome(result({ requiresTeacherValidation: false })).kind).toBe("corrected");
    expect(describeAttemptOutcome(result({ requiresTeacherValidation: true })).kind).toBe("pending_review");
  });
});
