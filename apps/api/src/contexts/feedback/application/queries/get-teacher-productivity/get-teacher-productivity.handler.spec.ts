import { describe, expect, it, vi } from "vitest";
import type {
  FeedbackReadModel,
  TeacherProductivitySignals,
} from "../../ports/feedback-read-model.port.js";
import {
  GetTeacherProductivityHandler,
  GetTeacherProductivityQuery,
} from "./get-teacher-productivity.handler.js";

describe("GetTeacherProductivityHandler", () => {
  it("devuelve productividad docente con señales accionables", async () => {
    const rows: TeacherProductivitySignals[] = [
      {
        teacherProfileId: "11111111-1111-4111-8111-111111111111",
        teacherName: "Carla Ruiz",
        scheduledHours: 22,
        contractedHours: 24,
        occupancyRate: 0.917,
        sessionCount: 22,
        studentsWithoutEvaluation: 0,
        studentsWithoutEvaluationNames: [],
        averageCsat: 4.6,
        csatResponses: 8,
        materialReviews: 2,
        averageMaterialReview: 3.5,
        pendingNegativeMaterialReviews: 1,
        lateStartedSessions: 2,
        completedSessions: 8,
        unsignedCorrectionsOlderThan7Days: 1,
      },
      {
        teacherProfileId: "22222222-2222-4222-8222-222222222222",
        teacherName: "Dan Whitfield",
        scheduledHours: 20,
        contractedHours: 24,
        occupancyRate: 0.833,
        sessionCount: 20,
        studentsWithoutEvaluation: 1,
        studentsWithoutEvaluationNames: ["Nerea Ojeda"],
        averageCsat: null,
        csatResponses: 0,
        materialReviews: 0,
        averageMaterialReview: null,
        pendingNegativeMaterialReviews: 0,
        lateStartedSessions: 0,
        completedSessions: 6,
        unsignedCorrectionsOlderThan7Days: 0,
      },
    ];
    const readModel: FeedbackReadModel = {
      npsScoresBetween: vi.fn(),
      teacherQualityBetween: vi.fn(),
      teacherProductivityBetween: vi.fn(async () => rows),
    };

    const result = await new GetTeacherProductivityHandler(readModel).execute(
      new GetTeacherProductivityQuery({
        from: "2026-07-27T00:00:00.000Z",
        to: "2026-08-03T00:00:00.000Z",
      }),
    );

    expect(readModel.teacherProductivityBetween).toHaveBeenCalledWith({
      from: new Date("2026-07-27T00:00:00.000Z"),
      to: new Date("2026-08-03T00:00:00.000Z"),
      staleEvaluationFrom: new Date("2026-07-13T00:00:00.000Z"),
      unsignedCorrectionBefore: new Date("2026-07-27T00:00:00.000Z"),
    });
    expect(result).toEqual([
      expect.objectContaining({
        teacherName: "Carla Ruiz",
        signal: "needs_attention",
        reasons: [
          "Ocupación por encima del 90 %",
          "1 corrección sin firmar desde hace más de 7 días",
          "1 reseña negativa de material pendiente",
          "2 clases empezaron tarde",
        ],
      }),
      expect.objectContaining({
        teacherName: "Dan Whitfield",
        signal: "needs_attention",
        reasons: ["1 alumno sin valorar en 3 semanas: Nerea Ojeda", "Sin CSAT en el periodo"],
      }),
    ]);
  });
});
