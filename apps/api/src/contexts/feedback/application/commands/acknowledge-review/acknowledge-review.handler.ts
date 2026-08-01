import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from "../../../../shared/domain/ports/unit-of-work.port.js";
import { MembershipId } from "../../../../shared/domain/primitives/school-id.js";
import { MissingReviewerMembershipError } from "../../../domain/errors/feedback.errors.js";
import {
  REVIEW_REPOSITORY,
  type ReviewRepository,
} from "../../../domain/ports/review.repository.port.js";
import { ReviewId } from "../../../domain/model/identifiers.js";
import { AcknowledgeReviewCommand } from "./acknowledge-review.command.js";

@CommandHandler(AcknowledgeReviewCommand)
export class AcknowledgeReviewHandler implements ICommandHandler<AcknowledgeReviewCommand> {
  constructor(
    @Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: AcknowledgeReviewCommand): Promise<{ reviewId: string; acknowledgedAt: string }> {
    const membershipId = this.tenant.membershipId();
    if (!membershipId) throw new MissingReviewerMembershipError();

    return this.uow.execute(async () => {
      const reviewId = ReviewId.of(command.props.reviewId);
      const review = await this.reviews.findById(reviewId);
      if (!review) throw new NotFoundError("reseña", command.props.reviewId);

      review.acknowledge({
        acknowledgedByMembershipId: MembershipId.of(membershipId),
        acknowledgedAt: this.clock.now(),
      });
      await this.reviews.save(review);

      return { reviewId: review.id.value, acknowledgedAt: review.acknowledgedAt!.toISOString() };
    });
  }
}
