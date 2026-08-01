import { describe, expect, it, vi } from "vitest";
import type {
  FeedbackReadModel,
  TeacherQualityRow,
} from "../../ports/feedback-read-model.port.js";
import { GetTeacherQualityHandler, GetTeacherQualityQuery } from "./get-teacher-quality.handler.js";

describe("GetTeacherQualityHandler", () => {
  it("devuelve CSAT medio por profesor en el periodo", async () => {
    const rows: TeacherQualityRow[] = [
      {
        teacherProfileId: "11111111-1111-4111-8111-111111111111",
        teacherName: "Ana López",
        responses: 2,
        averageCsat: 4.5,
        negativeReviewsPending: 1,
      },
    ];
    const readModel: FeedbackReadModel = {
      npsScoresBetween: vi.fn(),
      teacherQualityBetween: vi.fn(async () => rows),
      teacherProductivityBetween: vi.fn(),
    };

    const result = await new GetTeacherQualityHandler(readModel).execute(
      new GetTeacherQualityQuery({
        from: "2026-09-01T00:00:00.000Z",
        to: "2026-10-01T00:00:00.000Z",
      }),
    );

    expect(readModel.teacherQualityBetween).toHaveBeenCalledWith({
      from: new Date("2026-09-01T00:00:00.000Z"),
      to: new Date("2026-10-01T00:00:00.000Z"),
    });
    expect(result).toEqual(rows);
  });
});
