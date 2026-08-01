import type { ReviewSubject } from "../../../domain/model/survey-types.js";

export class CreateReviewCommand {
  constructor(
    readonly props: {
      subject: ReviewSubject;
      rating: number;
      comment?: string | null;
      contentUnitId?: string | null;
      sessionId?: string | null;
      teacherProfileId?: string | null;
    },
  ) {}
}
