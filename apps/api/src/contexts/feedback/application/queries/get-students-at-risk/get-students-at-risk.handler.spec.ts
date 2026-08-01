import { describe, expect, it } from "vitest";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import { ChurnRiskReasonSignal } from "../../../domain/model/churn-risk.vo.js";
import type {
  ChurnRiskReadModel,
  StudentChurnRiskSignals,
} from "../../ports/churn-risk-read-model.port.js";
import { GetStudentsAtRiskHandler } from "./get-students-at-risk.handler.js";

const NOW = new Date("2026-07-27T10:00:00Z");

function fakeClock(): Clock {
  return { now: () => NOW };
}

function fakeReadModel(rows: StudentChurnRiskSignals[]): ChurnRiskReadModel & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    signals: async (params) => {
      calls.push(params);
      return rows;
    },
  };
}

describe("GetStudentsAtRiskHandler (feedback)", () => {
  it("evalúa señales ponderadas y devuelve motivos explicables ordenados por riesgo", async () => {
    const readModel = fakeReadModel([
      {
        studentId: "paula",
        name: "Paula Vidal",
        attendanceRateLast4Weeks: 1,
        consecutiveAbsences: 0,
        weeksWithoutEvaluation: 0,
        lastProgressRating: 5,
        recentNegativeReviewRating: null,
        hasPastDueInvoice: false,
        latestNpsScore: 10,
      },
      {
        studentId: "lucia",
        name: "Lucía Ferrán",
        attendanceRateLast4Weeks: 0.333,
        consecutiveAbsences: 3,
        weeksWithoutEvaluation: 2,
        lastProgressRating: 2,
        recentNegativeReviewRating: null,
        hasPastDueInvoice: false,
        latestNpsScore: 4,
      },
    ]);
    const handler = new GetStudentsAtRiskHandler(readModel, fakeClock());

    const result = await handler.execute();

    expect(result).toEqual([
      {
        studentId: "lucia",
        name: "Lucía Ferrán",
        level: "high",
        score: 9,
        reasons: [
          expect.objectContaining({ signal: ChurnRiskReasonSignal.LowAttendance, weight: 3 }),
          expect.objectContaining({ signal: ChurnRiskReasonSignal.ConsecutiveAbsences, weight: 3 }),
          expect.objectContaining({ signal: ChurnRiskReasonSignal.LowProgressRating, weight: 2 }),
          expect.objectContaining({ signal: ChurnRiskReasonSignal.DetractorNps, weight: 1 }),
        ],
        signals: expect.objectContaining({
          attendanceRateLast4Weeks: 0.333,
          consecutiveAbsences: 3,
          lastProgressRating: 2,
          latestNpsScore: 4,
        }),
      },
      {
        studentId: "paula",
        name: "Paula Vidal",
        level: "low",
        score: 0,
        reasons: [],
        signals: expect.objectContaining({
          attendanceRateLast4Weeks: 1,
          lastProgressRating: 5,
          latestNpsScore: 10,
        }),
      },
    ]);
  });

  it("pide al read-model las ventanas de asistencia y reseñas desde el reloj", async () => {
    const readModel = fakeReadModel([]);
    const handler = new GetStudentsAtRiskHandler(readModel, fakeClock());

    await handler.execute();

    expect(readModel.calls).toEqual([
      {
        attendanceFrom: new Date(NOW.getTime() - 28 * 24 * 3_600_000),
        attendanceTo: NOW,
        recentReviewFrom: new Date(NOW.getTime() - 90 * 24 * 3_600_000),
        now: NOW,
      },
    ]);
  });
});
