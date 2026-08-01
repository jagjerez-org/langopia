import { AggregateRoot } from "../../../shared/domain/primitives/entity.js";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import {
  AlreadyAcknowledgedReviewError,
  InvalidReviewRatingError,
} from "../errors/feedback.errors.js";
import type { ContentUnitId, ReviewId, SessionId, TeacherProfileId } from "./identifiers.js";
import type { ReviewSubject } from "./survey-types.js";

export class Review extends AggregateRoot<ReviewId> {
  private constructor(
    id: ReviewId,
    private readonly _schoolId: SchoolId,
    private readonly _authorMembershipId: MembershipId,
    private readonly _subject: ReviewSubject,
    private readonly _rating: number,
    private readonly _comment: string | null,
    private readonly _contentUnitId: ContentUnitId | null,
    private readonly _sessionId: SessionId | null,
    private readonly _teacherProfileId: TeacherProfileId | null,
    private _acknowledgedAt: Date | null,
    private _acknowledgedByMembershipId: MembershipId | null,
    private readonly _createdAt: Date,
  ) {
    super(id);
  }

  static create(props: {
    id: ReviewId;
    schoolId: SchoolId;
    authorMembershipId: MembershipId;
    subject: ReviewSubject;
    rating: number;
    comment: string | null;
    contentUnitId: ContentUnitId | null;
    sessionId: SessionId | null;
    teacherProfileId: TeacherProfileId | null;
    now: Date;
  }): Review {
    Review.assertRating(props.rating);
    return new Review(
      props.id,
      props.schoolId,
      props.authorMembershipId,
      props.subject,
      props.rating,
      props.comment,
      props.contentUnitId,
      props.sessionId,
      props.teacherProfileId,
      null,
      null,
      props.now,
    );
  }

  static rehydrate(props: {
    id: ReviewId;
    schoolId: SchoolId;
    authorMembershipId: MembershipId;
    subject: ReviewSubject;
    rating: number;
    comment: string | null;
    contentUnitId: ContentUnitId | null;
    sessionId: SessionId | null;
    teacherProfileId: TeacherProfileId | null;
    acknowledgedAt: Date | null;
    acknowledgedByMembershipId: MembershipId | null;
    createdAt: Date;
  }): Review {
    Review.assertRating(props.rating);
    return new Review(
      props.id,
      props.schoolId,
      props.authorMembershipId,
      props.subject,
      props.rating,
      props.comment,
      props.contentUnitId,
      props.sessionId,
      props.teacherProfileId,
      props.acknowledgedAt,
      props.acknowledgedByMembershipId,
      props.createdAt,
    );
  }

  acknowledge(params: {
    acknowledgedByMembershipId: MembershipId;
    acknowledgedAt: Date;
  }): void {
    if (this._acknowledgedAt) throw new AlreadyAcknowledgedReviewError(this.id.value);
    this._acknowledgedAt = params.acknowledgedAt;
    this._acknowledgedByMembershipId = params.acknowledgedByMembershipId;
  }

  private static assertRating(rating: number): void {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new InvalidReviewRatingError(rating);
    }
  }

  get schoolId(): SchoolId {
    return this._schoolId;
  }
  get authorMembershipId(): MembershipId {
    return this._authorMembershipId;
  }
  get subject(): ReviewSubject {
    return this._subject;
  }
  get rating(): number {
    return this._rating;
  }
  get comment(): string | null {
    return this._comment;
  }
  get contentUnitId(): ContentUnitId | null {
    return this._contentUnitId;
  }
  get sessionId(): SessionId | null {
    return this._sessionId;
  }
  get teacherProfileId(): TeacherProfileId | null {
    return this._teacherProfileId;
  }
  get acknowledgedAt(): Date | null {
    return this._acknowledgedAt;
  }
  get acknowledgedByMembershipId(): MembershipId | null {
    return this._acknowledgedByMembershipId;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get requiresManagementAttention(): boolean {
    return this._rating <= 2 && this._acknowledgedAt === null;
  }
}
