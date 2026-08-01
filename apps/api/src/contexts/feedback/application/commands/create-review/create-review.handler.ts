import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  ID_GENERATOR,
  type IdGenerator,
} from "../../../../shared/domain/ports/id-generator.port.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from "../../../../shared/domain/ports/unit-of-work.port.js";
import { MembershipId, SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import { MissingReviewerMembershipError } from "../../../domain/errors/feedback.errors.js";
import {
  REVIEW_REPOSITORY,
  type ReviewRepository,
} from "../../../domain/ports/review.repository.port.js";
import { ContentUnitId, ReviewId, SessionId, TeacherProfileId } from "../../../domain/model/identifiers.js";
import { Review } from "../../../domain/model/review.aggregate.js";
import { CreateReviewCommand } from "./create-review.command.js";

export type CreateReviewResult = {
  reviewId: string;
  requiresManagementAttention: boolean;
  managementAlert: { kind: "negative_review"; message: string } | null;
};

@CommandHandler(CreateReviewCommand)
export class CreateReviewHandler implements ICommandHandler<CreateReviewCommand> {
  constructor(
    @Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: CreateReviewCommand): Promise<CreateReviewResult> {
    const membershipId = this.tenant.membershipId();
    if (!membershipId) throw new MissingReviewerMembershipError();

    return this.uow.execute(async () => {
      const review = Review.create({
        id: ReviewId.of(this.ids.generate()),
        schoolId: SchoolId.of(this.tenant.schoolId()),
        authorMembershipId: MembershipId.of(membershipId),
        subject: command.props.subject,
        rating: command.props.rating,
        comment: command.props.comment ?? null,
        contentUnitId: command.props.contentUnitId
          ? ContentUnitId.of(command.props.contentUnitId)
          : null,
        sessionId: command.props.sessionId ? SessionId.of(command.props.sessionId) : null,
        teacherProfileId: command.props.teacherProfileId
          ? TeacherProfileId.of(command.props.teacherProfileId)
          : null,
        now: this.clock.now(),
      });

      await this.reviews.save(review);

      return {
        reviewId: review.id.value,
        requiresManagementAttention: review.requiresManagementAttention,
        managementAlert: review.requiresManagementAttention
          ? {
              kind: "negative_review",
              message: "Reseña negativa pendiente de revisión por dirección.",
            }
          : null,
      };
    });
  }
}
