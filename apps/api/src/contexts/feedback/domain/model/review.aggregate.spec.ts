import { describe, expect, it } from "vitest";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import {
  AlreadyAcknowledgedReviewError,
  InvalidReviewRatingError,
} from "../errors/feedback.errors.js";
import { ReviewId, SessionId, TeacherProfileId } from "./identifiers.js";
import { Review } from "./review.aggregate.js";

const REVIEW_ID = ReviewId.of("11111111-1111-4111-8111-111111111111");
const SCHOOL_ID = SchoolId.of("22222222-2222-4222-8222-222222222222");
const AUTHOR_ID = MembershipId.of("33333333-3333-4333-8333-333333333333");
const MANAGER_ID = MembershipId.of("44444444-4444-4444-8444-444444444444");
const SESSION_ID = SessionId.of("55555555-5555-4555-8555-555555555555");
const TEACHER_ID = TeacherProfileId.of("66666666-6666-4666-8666-666666666666");
const NOW = new Date("2026-09-10T12:00:00.000Z");

describe("Review", () => {
  it("deja una reseña negativa pendiente de dirección", () => {
    const review = Review.create({
      id: REVIEW_ID,
      schoolId: SCHOOL_ID,
      authorMembershipId: AUTHOR_ID,
      subject: "session",
      rating: 2,
      comment: "La clase fue confusa",
      contentUnitId: null,
      sessionId: SESSION_ID,
      teacherProfileId: TEACHER_ID,
      now: NOW,
    });

    expect(review.requiresManagementAttention).toBe(true);
    expect(review.acknowledgedAt).toBeNull();
  });

  it("permite acusar recibo una sola vez", () => {
    const review = Review.create({
      id: REVIEW_ID,
      schoolId: SCHOOL_ID,
      authorMembershipId: AUTHOR_ID,
      subject: "teacher",
      rating: 1,
      comment: null,
      contentUnitId: null,
      sessionId: null,
      teacherProfileId: TEACHER_ID,
      now: NOW,
    });

    review.acknowledge({ acknowledgedByMembershipId: MANAGER_ID, acknowledgedAt: NOW });

    expect(review.acknowledgedAt).toBe(NOW);
    expect(review.acknowledgedByMembershipId?.value).toBe(MANAGER_ID.value);
    expect(() =>
      review.acknowledge({ acknowledgedByMembershipId: MANAGER_ID, acknowledgedAt: NOW }),
    ).toThrow(AlreadyAcknowledgedReviewError);
  });

  it("rechaza puntuaciones fuera de 1 a 5", () => {
    expect(() =>
      Review.create({
        id: REVIEW_ID,
        schoolId: SCHOOL_ID,
        authorMembershipId: AUTHOR_ID,
        subject: "material",
        rating: 0,
        comment: null,
        contentUnitId: null,
        sessionId: null,
        teacherProfileId: null,
        now: NOW,
      }),
    ).toThrow(InvalidReviewRatingError);
  });
});
