import { describe, expect, it } from "vitest";
import { ChurnRisk, type ChurnRiskSignals } from "./churn-risk.vo.js";

const HEALTHY: ChurnRiskSignals = {
  attendanceRateLast4Weeks: 0.9,
  consecutiveAbsences: 0,
  weeksWithoutEvaluation: 1,
  lastProgressRating: 4,
  recentNegativeReviewRating: null,
  hasPastDueInvoice: false,
  latestNpsScore: 9,
};

describe("ChurnRisk", () => {
  it.each([
    ["asistencia baja", { attendanceRateLast4Weeks: 0.59 }, "low_attendance", 3],
    ["faltas consecutivas", { consecutiveAbsences: 3 }, "consecutive_absences", 3],
    ["semanas sin valoración", { weeksWithoutEvaluation: 3 }, "no_recent_evaluation", 2],
    ["sin valoración registrada", { weeksWithoutEvaluation: null }, "no_recent_evaluation", 2],
    ["última valoración baja", { lastProgressRating: 2 }, "low_progress_rating", 2],
    ["reseña negativa reciente", { recentNegativeReviewRating: 2 }, "negative_recent_review", 1],
    ["factura vencida", { hasPastDueInvoice: true }, "past_due_invoice", 2],
    ["NPS detractor", { latestNpsScore: 6 }, "detractor_nps", 1],
  ] as const)("incluye motivo y peso para %s", (_label, partial, signal, weight) => {
    const risk = ChurnRisk.evaluate({ ...HEALTHY, ...partial });

    expect(risk.reasons).toEqual([expect.objectContaining({ signal, weight })]);
  });

  it("marca medium a partir de 3 puntos", () => {
    const risk = ChurnRisk.evaluate({
      ...HEALTHY,
      recentNegativeReviewRating: 2,
      hasPastDueInvoice: true,
    });

    expect(risk.level).toBe("medium");
    expect(risk.score).toBe(3);
    expect(risk.reasons.map((reason) => reason.signal)).toEqual([
      "negative_recent_review",
      "past_due_invoice",
    ]);
  });

  it("marca high a partir de 5 puntos", () => {
    const risk = ChurnRisk.evaluate({
      ...HEALTHY,
      attendanceRateLast4Weeks: 0.5,
      lastProgressRating: 2,
    });

    expect(risk.level).toBe("high");
    expect(risk.score).toBe(5);
  });

  it("un alumno sano queda en low sin motivos", () => {
    const risk = ChurnRisk.evaluate(HEALTHY);

    expect(risk).toEqual({ level: "low", score: 0, reasons: [] });
  });

  it("los umbrales inclusivos y exclusivos son exactos", () => {
    expect(ChurnRisk.evaluate({ ...HEALTHY, attendanceRateLast4Weeks: 0.6 }).reasons).toEqual([]);
    expect(ChurnRisk.evaluate({ ...HEALTHY, consecutiveAbsences: 2 }).reasons).toEqual([]);
    expect(ChurnRisk.evaluate({ ...HEALTHY, weeksWithoutEvaluation: 2 }).reasons).toEqual([]);
    expect(ChurnRisk.evaluate({ ...HEALTHY, lastProgressRating: 3 }).reasons).toEqual([]);
    expect(ChurnRisk.evaluate({ ...HEALTHY, recentNegativeReviewRating: 3 }).reasons).toEqual([]);
    expect(ChurnRisk.evaluate({ ...HEALTHY, latestNpsScore: 7 }).reasons).toEqual([]);
  });
});
