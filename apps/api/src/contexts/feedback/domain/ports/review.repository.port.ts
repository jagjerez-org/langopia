import type { ReviewId } from "../model/identifiers.js";
import type { Review } from "../model/review.aggregate.js";

export interface ReviewRepository {
  findById(id: ReviewId): Promise<Review | null>;
  save(review: Review): Promise<void>;
}

export const REVIEW_REPOSITORY = Symbol("ReviewRepository");
