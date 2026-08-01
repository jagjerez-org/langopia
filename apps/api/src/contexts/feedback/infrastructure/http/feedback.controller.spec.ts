import { describe, expect, it, vi } from "vitest";
import { AcknowledgeReviewCommand } from "../../application/commands/acknowledge-review/acknowledge-review.command.js";
import { CreateReviewCommand } from "../../application/commands/create-review/create-review.command.js";
import { RespondToSurveyCommand } from "../../application/commands/respond-to-survey/respond-to-survey.command.js";
import { GetNpsQuery } from "../../application/queries/get-nps/get-nps.handler.js";
import { GetStudentsAtRiskQuery } from "../../application/queries/get-students-at-risk/get-students-at-risk.handler.js";
import { GetTeacherProductivityQuery } from "../../application/queries/get-teacher-productivity/get-teacher-productivity.handler.js";
import { GetTeacherQualityQuery } from "../../application/queries/get-teacher-quality/get-teacher-quality.handler.js";
import { FeedbackController } from "./feedback.controller.js";

describe("FeedbackController", () => {
  it("traduce la respuesta de alumno a comando", async () => {
    const execute = vi.fn(async () => ({ responseId: "r", replaced: false }));
    const controller = new FeedbackController({ execute } as never, {} as never);

    const result = await controller.respond("22222222-2222-4222-8222-222222222222", {
      score: 5,
      comment: "Muy útil",
      sessionId: "33333333-3333-4333-8333-333333333333",
    });

    expect(result).toEqual({ responseId: "r", replaced: false });
    expect(execute).toHaveBeenCalledWith(
      new RespondToSurveyCommand({
        surveyId: "22222222-2222-4222-8222-222222222222",
        score: 5,
        comment: "Muy útil",
        sessionId: "33333333-3333-4333-8333-333333333333",
        teacherProfileId: null,
      }),
    );
  });

  it("traduce las consultas de dirección a query bus", async () => {
    const execute = vi.fn(async () => []);
    const controller = new FeedbackController({} as never, { execute } as never);

    await controller.nps({
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-10-01T00:00:00.000Z",
    });
    await controller.teacherQuality({
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-10-01T00:00:00.000Z",
    });
    await controller.teacherProductivity({
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-10-01T00:00:00.000Z",
    });
    await controller.studentsAtRisk();

    expect(execute).toHaveBeenNthCalledWith(
      1,
      new GetNpsQuery({
        from: "2026-09-01T00:00:00.000Z",
        to: "2026-10-01T00:00:00.000Z",
      }),
    );
    expect(execute).toHaveBeenNthCalledWith(
      2,
      new GetTeacherQualityQuery({
        from: "2026-09-01T00:00:00.000Z",
        to: "2026-10-01T00:00:00.000Z",
      }),
    );
    expect(execute).toHaveBeenNthCalledWith(
      3,
      new GetTeacherProductivityQuery({
        from: "2026-09-01T00:00:00.000Z",
        to: "2026-10-01T00:00:00.000Z",
      }),
    );
    expect(execute).toHaveBeenNthCalledWith(4, new GetStudentsAtRiskQuery());
  });

  it("traduce reseña y acuse a comandos", async () => {
    const execute = vi.fn(async () => ({ reviewId: "r" }));
    const controller = new FeedbackController({ execute } as never, {} as never);

    await controller.createReview({
      subject: "session",
      rating: 2,
      comment: "Muy confusa",
      sessionId: "33333333-3333-4333-8333-333333333333",
    });
    await controller.acknowledgeReview("22222222-2222-4222-8222-222222222222");

    expect(execute).toHaveBeenNthCalledWith(
      1,
      new CreateReviewCommand({
        subject: "session",
        rating: 2,
        comment: "Muy confusa",
        contentUnitId: null,
        sessionId: "33333333-3333-4333-8333-333333333333",
        teacherProfileId: null,
      }),
    );
    expect(execute).toHaveBeenNthCalledWith(
      2,
      new AcknowledgeReviewCommand({ reviewId: "22222222-2222-4222-8222-222222222222" }),
    );
  });
});
