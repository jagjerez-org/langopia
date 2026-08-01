import * as schema from "@langopia/db/schema";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import {
  ContentUnitId,
  ReviewId,
  SessionId,
  TeacherProfileId,
} from "../../domain/model/identifiers.js";
import { Review } from "../../domain/model/review.aggregate.js";
import type { ReviewSubject } from "../../domain/model/survey-types.js";

type ReviewRow = typeof schema.reviews.$inferSelect;

export class ReviewMapper {
  static toDomain(row: ReviewRow): Review {
    return Review.rehydrate({
      id: ReviewId.of(row.id),
      schoolId: SchoolId.of(row.schoolId),
      authorMembershipId: MembershipId.of(row.authorMembershipId),
      subject: row.subject as ReviewSubject,
      rating: row.rating,
      comment: row.comment,
      contentUnitId: row.contentUnitId ? ContentUnitId.of(row.contentUnitId) : null,
      sessionId: row.sessionId ? SessionId.of(row.sessionId) : null,
      teacherProfileId: row.teacherProfileId ? TeacherProfileId.of(row.teacherProfileId) : null,
      acknowledgedAt: row.acknowledgedAt,
      acknowledgedByMembershipId: row.acknowledgedByMembershipId
        ? MembershipId.of(row.acknowledgedByMembershipId)
        : null,
      createdAt: row.createdAt,
    });
  }
}
