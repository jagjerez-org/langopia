import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { StudentSubscription, Student, AcademyPlan, Academy } from "../database/entities/index.js";
import { StripeClientService } from "../stripe-client/stripe-client.service.js";
import { StudentSubscriptionStatus } from "@langopia/shared/types";
import { CreateStudentSubscriptionDto } from "./dto/create-student-subscription.dto.js";
import { CancelSubscriptionDto } from "./dto/cancel-subscription.dto.js";
import { CreatePublicSubscriptionDto } from "./dto/create-public-subscription.dto.js";

@Injectable()
export class StudentSubscriptionsService {
  private readonly logger = new Logger(StudentSubscriptionsService.name);

  constructor(
    @InjectRepository(StudentSubscription)
    private readonly subscriptionRepo: Repository<StudentSubscription>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(AcademyPlan)
    private readonly planRepo: Repository<AcademyPlan>,
    @InjectRepository(Academy)
    private readonly academyRepo: Repository<Academy>,
    private readonly stripeClient: StripeClientService,
    private readonly config: ConfigService,
  ) {}

  async list(academyId: string) {
    return this.subscriptionRepo.find({
      where: { academyId },
      relations: ["student", "academyPlan"],
      order: { createdAt: "DESC" },
    });
  }

  async findOne(academyId: string, id: string) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { id, academyId },
      relations: ["student", "academyPlan"],
    });
    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }
    return subscription;
  }

  async create(academyId: string, dto: CreateStudentSubscriptionDto) {
    const student = await this.studentRepo.findOne({
      where: { id: dto.studentId },
    });
    if (!student) {
      throw new NotFoundException("Student not found");
    }
    if (student.academyId !== academyId) {
      throw new BadRequestException("Student does not belong to this academy");
    }

    const plan = await this.planRepo.findOne({
      where: { id: dto.academyPlanId, academyId },
    });
    if (!plan) {
      throw new NotFoundException("Academy plan not found");
    }
    if (!plan.stripePriceId) {
      throw new BadRequestException("Plan does not have a Stripe price configured");
    }

    const academy = await this.academyRepo.findOne({
      where: { id: academyId },
    });
    if (!academy) {
      throw new NotFoundException("Academy not found");
    }
    if (!academy.stripeConnectAccountId) {
      throw new BadRequestException("Stripe Connect not configured");
    }

    const stripe = this.stripeClient.getStripe();
    const appUrl = this.config.get("APP_URL", "http://localhost:3000");

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      customer_email: student.email,
      metadata: {
        studentId: student.id,
        academyPlanId: plan.id,
        academyId,
      },
      success_url: dto.successUrl ?? `${appUrl}/subscription/success`,
      cancel_url: dto.cancelUrl ?? `${appUrl}/subscription/cancelled`,
      subscription_data: {
        application_fee_percent: 2,
      },
    }, {
      stripeAccount: academy.stripeConnectAccountId,
    });

    const subscription = this.subscriptionRepo.create({
      studentId: student.id,
      academyPlanId: plan.id,
      academyId,
      status: StudentSubscriptionStatus.ACTIVE,
    });
    await this.subscriptionRepo.save(subscription);

    return { subscriptionId: subscription.id, checkoutUrl: checkoutSession.url };
  }

  async cancel(academyId: string, id: string, dto: CancelSubscriptionDto) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { id, academyId },
    });
    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }

    if (subscription.stripeSubscriptionId) {
      const academy = await this.academyRepo.findOne({
        where: { id: academyId },
      });

      const stripe = this.stripeClient.getStripe();
      const stripeAccount = academy?.stripeConnectAccountId ?? undefined;

      if (dto.immediate) {
        await stripe.subscriptions.cancel(subscription.stripeSubscriptionId, undefined, {
          stripeAccount,
        });
      } else {
        await stripe.subscriptions.update(
          subscription.stripeSubscriptionId,
          { cancel_at_period_end: true },
          { stripeAccount },
        );
      }
    }

    subscription.status = StudentSubscriptionStatus.CANCELLED;
    subscription.cancelledAt = new Date();
    await this.subscriptionRepo.save(subscription);

    return subscription;
  }

  async createPublicSubscription(
    slug: string,
    dto: CreatePublicSubscriptionDto,
  ) {
    const academy = await this.academyRepo.findOne({
      where: { slug },
    });
    if (!academy) {
      throw new NotFoundException("Academy not found");
    }
    if (!academy.stripeConnectAccountId) {
      throw new BadRequestException("Stripe Connect not configured");
    }

    const plan = await this.planRepo.findOne({
      where: { id: dto.academyPlanId, academyId: academy.id },
    });
    if (!plan) {
      throw new NotFoundException("Academy plan not found");
    }
    if (!plan.stripePriceId) {
      throw new BadRequestException("Plan does not have a Stripe price configured");
    }

    // Find or create student
    let student = await this.studentRepo.findOne({
      where: { email: dto.email, academyId: academy.id },
    });
    if (!student) {
      student = this.studentRepo.create({
        email: dto.email,
        name: dto.name,
        academyId: academy.id,
      });
      await this.studentRepo.save(student);
    }

    const stripe = this.stripeClient.getStripe();
    const appUrl = this.config.get("APP_URL", "http://localhost:3000");

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      customer_email: student.email,
      metadata: {
        studentId: student.id,
        academyPlanId: plan.id,
        academyId: academy.id,
      },
      success_url: dto.successUrl ?? `${appUrl}/subscription/success`,
      cancel_url: dto.cancelUrl ?? `${appUrl}/subscription/cancelled`,
      subscription_data: {
        application_fee_percent: 2,
      },
    }, {
      stripeAccount: academy.stripeConnectAccountId,
    });

    const subscription = this.subscriptionRepo.create({
      studentId: student.id,
      academyPlanId: plan.id,
      academyId: academy.id,
      status: StudentSubscriptionStatus.ACTIVE,
    });
    await this.subscriptionRepo.save(subscription);

    return { subscriptionId: subscription.id, checkoutUrl: checkoutSession.url };
  }
}
