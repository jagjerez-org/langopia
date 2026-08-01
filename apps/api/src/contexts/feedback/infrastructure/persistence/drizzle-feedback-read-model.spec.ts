import { describe, expect, it, vi } from "vitest";
import type { UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { DrizzleFeedbackReadModel } from "./drizzle-feedback-read-model.js";

describe("DrizzleFeedbackReadModel.teacherProductivityBetween", () => {
  it("ejecuta la consulta dentro de uow.read y mapea métricas por profesor", async () => {
    const execute = vi.fn(async () => [
      {
        teacher_profile_id: "11111111-1111-4111-8111-111111111111",
        teacher_name: "Dan Whitfield",
        scheduled_minutes: 1_200,
        contracted_hours_week: 24,
        session_count: 20,
        completed_sessions: 6,
        late_started_sessions: 1,
        students_without_evaluation: 1,
        students_without_evaluation_names: ["Nerea Ojeda"],
        csat_responses: 0,
        average_csat: null,
        material_reviews: 1,
        average_material_review: 2,
        pending_negative_material_reviews: 1,
        unsigned_corrections_older_than_7_days: 2,
      },
    ]);
    const read = vi.fn(async (work: () => Promise<unknown>) => work());
    const model = new DrizzleFeedbackReadModel(
      { db: { execute } } as never,
      { read } as unknown as UnitOfWork,
    );

    const result = await model.teacherProductivityBetween({
      from: new Date("2026-07-27T00:00:00.000Z"),
      to: new Date("2026-08-03T00:00:00.000Z"),
      staleEvaluationFrom: new Date("2026-07-13T00:00:00.000Z"),
      unsignedCorrectionBefore: new Date("2026-07-27T00:00:00.000Z"),
    });

    expect(read).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
    expect(result).toEqual([
      {
        teacherProfileId: "11111111-1111-4111-8111-111111111111",
        teacherName: "Dan Whitfield",
        scheduledHours: 20,
        contractedHours: 24,
        occupancyRate: 0.833,
        sessionCount: 20,
        studentsWithoutEvaluation: 1,
        studentsWithoutEvaluationNames: ["Nerea Ojeda"],
        averageCsat: null,
        csatResponses: 0,
        materialReviews: 1,
        averageMaterialReview: 2,
        pendingNegativeMaterialReviews: 1,
        lateStartedSessions: 1,
        completedSessions: 6,
        unsignedCorrectionsOlderThan7Days: 2,
      },
    ]);
  });
});
