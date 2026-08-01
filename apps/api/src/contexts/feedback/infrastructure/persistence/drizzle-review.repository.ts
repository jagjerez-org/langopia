import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import * as schema from "@langopia/db/schema";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { ReviewId } from "../../domain/model/identifiers.js";
import type { Review } from "../../domain/model/review.aggregate.js";
import type { ReviewRepository } from "../../domain/ports/review.repository.port.js";
import { ReviewMapper } from "./review.mapper.js";

@Injectable()
export class DrizzleReviewRepository implements ReviewRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async findById(id: ReviewId): Promise<Review | null> {
    const rows = await this.drizzle.db.select().from(schema.reviews).where(eq(schema.reviews.id, id.value)).limit(1);
    const row = rows[0];
    return row ? ReviewMapper.toDomain(row) : null;
  }

  async save(review: Review): Promise<void> {
    await this.drizzle.db
      .insert(schema.reviews)
      .values({
        id: review.id.value,
        schoolId: review.schoolId.value,
        authorMembershipId: review.authorMembershipId.value,
        subject: review.subject,
        contentUnitId: review.contentUnitId?.value ?? null,
        sessionId: review.sessionId?.value ?? null,
        teacherProfileId: review.teacherProfileId?.value ?? null,
        rating: review.rating,
        comment: review.comment,
        acknowledgedAt: review.acknowledgedAt,
        acknowledgedByMembershipId: review.acknowledgedByMembershipId?.value ?? null,
        createdAt: review.createdAt,
      })
      .onConflictDoUpdate({
        target: schema.reviews.id,
        set: {
          acknowledgedAt: review.acknowledgedAt,
          acknowledgedByMembershipId: review.acknowledgedByMembershipId?.value ?? null,
        },
      });
  }
}
