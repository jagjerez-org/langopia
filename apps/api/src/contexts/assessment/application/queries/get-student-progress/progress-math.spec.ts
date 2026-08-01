import { describe, expect, it } from "vitest";
import {
  computeAverageScore,
  computeCompletionRate,
  computeReviewStreak,
  computeSkillBreakdown,
  computeTrend,
} from "./progress-math.js";
import type { ValidatableAttempt } from "./progress-math.js";

function attempt(over: Partial<ValidatableAttempt> = {}): ValidatableAttempt {
  return {
    status: "teacher_validated",
    teacherScore: 1,
    maxScore: 1,
    skill: "grammar",
    weekStart: "2026-07-06",
    ...over,
  };
}

describe("computeCompletionRate (Paso 1 del brief, verbatim: 3 de 6 ejercicios da 50 %)", () => {
  it("3 de 6 ejercicios publicados da 0.5", () => {
    expect(computeCompletionRate(6, 3)).toBe(0.5);
  });

  it("sin ningún ejercicio publicado a sus grupos, no hay porcentaje que calcular: null, no 0", () => {
    expect(computeCompletionRate(0, 0)).toBeNull();
  });

  it("todo completado da 1", () => {
    expect(computeCompletionRate(4, 4)).toBe(1);
  });
});

describe("computeAverageScore (Paso 2 del brief: los intentos sin firmar NO cuentan)", () => {
  it("un intento ai_graded (sin firmar) no cuenta en la media, aunque tenga aiScore", () => {
    const result = computeAverageScore([
      attempt({ status: "ai_graded", teacherScore: null }),
    ]);

    expect(result).toEqual({ average: null, validatedCount: 0 });
  });

  it("mezclando intentos validados y sin firmar, solo promedia los validados", () => {
    const result = computeAverageScore([
      attempt({ status: "teacher_validated", teacherScore: 2, maxScore: 2 }), // 1.0
      attempt({ status: "ai_graded", teacherScore: null, maxScore: 2 }), // ignorado
      attempt({ status: "returned", teacherScore: null, maxScore: 2 }), // ignorado
    ]);

    expect(result).toEqual({ average: 1, validatedCount: 1 });
  });

  it("promedia el ratio (nota/máximo) de varios ejercicios con escalas distintas", () => {
    const result = computeAverageScore([
      attempt({ teacherScore: 1, maxScore: 2 }), // 0.5
      attempt({ teacherScore: 18, maxScore: 20 }), // 0.9
    ]);

    expect(result.validatedCount).toBe(2);
    expect(result.average).toBeCloseTo(0.7, 5);
  });

  it("sin ningún intento validado todavía, la media es null, no 0", () => {
    expect(computeAverageScore([])).toEqual({ average: null, validatedCount: 0 });
  });
});

describe("computeSkillBreakdown", () => {
  it("agrupa solo los intentos validados por destreza", () => {
    const result = computeSkillBreakdown([
      attempt({ skill: "reading", teacherScore: 1, maxScore: 1 }),
      attempt({ skill: "reading", teacherScore: 0, maxScore: 1 }),
      attempt({ skill: "writing", teacherScore: 1, maxScore: 2 }),
      attempt({ skill: "writing", status: "ai_graded", teacherScore: null }), // ignorado
    ]);

    expect(result).toEqual([
      { skill: "reading", averageScore: 0.5, attemptCount: 2 },
      { skill: "writing", averageScore: 0.5, attemptCount: 1 },
    ]);
  });

  it("sin intentos validados, la lista viene vacía", () => {
    expect(computeSkillBreakdown([])).toEqual([]);
  });
});

describe("computeTrend (media móvil de hasta 4 semanas)", () => {
  it("con menos de 4 semanas de datos, la media móvil usa solo las que hay", () => {
    const result = computeTrend([
      attempt({ weekStart: "2026-06-01", teacherScore: 1, maxScore: 1 }),
      attempt({ weekStart: "2026-06-08", teacherScore: 0, maxScore: 1 }),
    ]);

    expect(result).toEqual([
      { weekStart: "2026-06-01", averageScore: 1, movingAverage: 1 },
      { weekStart: "2026-06-08", averageScore: 0, movingAverage: 0.5 },
    ]);
  });

  it("con 5 semanas, la quinta promedia solo las 4 más recientes (ventana móvil)", () => {
    const weeks = ["2026-06-01", "2026-06-08", "2026-06-15", "2026-06-22", "2026-06-29"];
    const scores = [1, 1, 1, 1, 0]; // semana 1 (score 1) queda fuera de la ventana de la quinta
    const attempts = weeks.map((weekStart, i) => attempt({ weekStart, teacherScore: scores[i]!, maxScore: 1 }));

    const result = computeTrend(attempts);

    expect(result[4]).toEqual({ weekStart: "2026-06-29", averageScore: 0, movingAverage: 0.75 });
  });

  it("los intentos sin firmar tampoco entran en la tendencia", () => {
    const result = computeTrend([
      attempt({ weekStart: "2026-06-01", status: "ai_graded", teacherScore: null }),
    ]);

    expect(result).toEqual([]);
  });
});

describe("computeReviewStreak", () => {
  it("sin ningún día de repaso registrado, la racha es 0", () => {
    expect(computeReviewStreak("2026-07-27", [])).toBe(0);
  });

  it("repasó hoy y los tres días anteriores: racha de 4", () => {
    const days = ["2026-07-27", "2026-07-26", "2026-07-25", "2026-07-24"];
    expect(computeReviewStreak("2026-07-27", days)).toBe(4);
  });

  it("todavía no ha repasado hoy, pero sí ayer (y antes): la racha sigue viva por gracia", () => {
    const days = ["2026-07-26", "2026-07-25"];
    expect(computeReviewStreak("2026-07-27", days)).toBe(2);
  });

  it("ni hoy ni ayer: la racha se ha roto, aunque haya días sueltos más atrás", () => {
    const days = ["2026-07-20"];
    expect(computeReviewStreak("2026-07-27", days)).toBe(0);
  });

  it("un hueco intermedio corta la racha en ese punto", () => {
    const days = ["2026-07-27", "2026-07-26", "2026-07-24"]; // falta el 25
    expect(computeReviewStreak("2026-07-27", days)).toBe(2);
  });
});
