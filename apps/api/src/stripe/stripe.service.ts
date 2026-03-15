import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../database/entities/user.entity.js";
import { Academy } from "../database/entities/academy.entity.js";
import { AcademyMember } from "../database/entities/academy-member.entity.js";
import { StudentSubscription } from "../database/entities/student-subscription.entity.js";
import { StripeClientService } from "../stripe-client/stripe-client.service.js";
import { UserPlan, StudentSubscriptionStatus } from "@langopia/shared/types";

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Academy)
    private readonly academyRepo: Repository<Academy>,
    @InjectRepository(AcademyMember)
    private readonly academyMemberRepo: Repository<AcademyMember>,
    @InjectRepository(StudentSubscription)
    private readonly studentSubscriptionRepo: Repository<StudentSubscription>,
    private readonly stripeClient: StripeClientService,
    private readonly config: ConfigService,
  ) {}

  async createCheckoutSession(userId: string, plan: string) {
    const priceId = this.stripeClient.PLAN_PRICE_IDS[plan];
    if (!priceId) {
      throw new BadRequestException("Invalid plan");
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const stripe = this.stripeClient.getStripe();
    const appUrl = this.config.get("APP_URL", "http://localhost:3000");

    // Create or reuse Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await this.userRepo.save(user);
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard/billing?success=true`,
      cancel_url: `${appUrl}/dashboard/billing?canceled=true`,
      metadata: { userId: user.id, plan },
    });

    return { url: checkoutSession.url };
  }

  async createPortalSession(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user?.stripeCustomerId) {
      throw new BadRequestException("No billing account found");
    }

    const stripe = this.stripeClient.getStripe();
    const appUrl = this.config.get("APP_URL", "http://localhost:3000");

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appUrl}/dashboard/billing`,
    });

    return { url: portalSession.url };
  }

  async createConnectAccount(userId: string, academyId: string) {
    const academy = await this.academyRepo.findOne({
      where: { id: academyId },
    });
    if (!academy) {
      throw new NotFoundException("Academy not found");
    }

    const stripe = this.stripeClient.getStripe();
    const appUrl = this.config.get("APP_URL", "http://localhost:3000");

    // Create Stripe Connect account if not already created
    let accountId = academy.stripeConnectAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "standard",
        metadata: { academyId: academy.id, userId },
      });
      accountId = account.id;
      academy.stripeConnectAccountId = accountId;
      await this.academyRepo.save(academy);
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/dashboard/billing?connect=refresh`,
      return_url: `${appUrl}/dashboard/billing?connect=complete`,
      type: "account_onboarding",
    });

    return { url: accountLink.url };
  }

  async getConnectStatus(academyId: string) {
    const academy = await this.academyRepo.findOne({
      where: { id: academyId },
    });
    if (!academy) {
      throw new NotFoundException("Academy not found");
    }

    if (!academy.stripeConnectAccountId) {
      return { status: "not_started" };
    }

    const stripe = this.stripeClient.getStripe();
    const account = await stripe.accounts.retrieve(academy.stripeConnectAccountId);

    return {
      status: account.charges_enabled ? "active" : "pending",
      details_submitted: account.details_submitted,
    };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const webhookSecret = this.config.get<string>("STRIPE_WEBHOOK_SECRET");
    if (!signature || !webhookSecret) {
      throw new BadRequestException("Missing signature");
    }

    const stripe = this.stripeClient.getStripe();
    let event;

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      this.logger.error("Webhook signature verification failed:", err);
      throw new BadRequestException("Invalid signature");
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;

        if (userId && plan) {
          const user = await this.userRepo.findOne({
            where: { id: userId },
          });
          if (user) {
            user.plan = plan as UserPlan;
            user.stripeSubscriptionId =
              typeof session.subscription === "string"
                ? session.subscription
                : null;
            await this.userRepo.save(user);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.toString();

        if (customerId) {
          const user = await this.userRepo.findOne({
            where: { stripeCustomerId: customerId },
          });
          if (user) {
            user.stripeSubscriptionId = subscription.id;
            if (subscription.status === "active") {
              // Plan is managed by checkout metadata
            } else if (
              subscription.status === "canceled" ||
              subscription.status === "unpaid"
            ) {
              user.plan = UserPlan.FREE;
            }
            await this.userRepo.save(user);
          }
        }

        // Also handle Connect student subscriptions
        const studentSub = await this.studentSubscriptionRepo.findOne({
          where: { stripeSubscriptionId: subscription.id },
        });
        if (studentSub) {
          if (subscription.current_period_start) {
            studentSub.currentPeriodStart = new Date(
              (subscription.current_period_start as number) * 1000,
            );
          }
          if (subscription.current_period_end) {
            studentSub.currentPeriodEnd = new Date(
              (subscription.current_period_end as number) * 1000,
            );
          }
          if (subscription.status === "active") {
            studentSub.status = StudentSubscriptionStatus.ACTIVE;
          } else if (
            subscription.status === "canceled" ||
            subscription.status === "unpaid"
          ) {
            studentSub.status = StudentSubscriptionStatus.CANCELLED;
            studentSub.cancelledAt = new Date();
          } else if (subscription.status === "past_due") {
            studentSub.status = StudentSubscriptionStatus.PAST_DUE;
          }
          await this.studentSubscriptionRepo.save(studentSub);
          this.logger.log(
            `StudentSubscription ${studentSub.id} updated via webhook: status=${subscription.status}`,
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.toString();

        if (customerId) {
          const user = await this.userRepo.findOne({
            where: { stripeCustomerId: customerId },
          });
          if (user) {
            user.plan = UserPlan.FREE;
            user.stripeSubscriptionId = null;
            await this.userRepo.save(user);
          }
        }

        // Also handle Connect student subscriptions
        await this.handleConnectSubscriptionDeleted(event.data.object);
        break;
      }

      case "account.updated": {
        const account = event.data.object;
        if (account.id) {
          const academy = await this.academyRepo.findOne({
            where: { stripeConnectAccountId: account.id },
          });
          if (academy) {
            academy.onboardingCompleted = !!account.charges_enabled;
            await this.academyRepo.save(academy);
            this.logger.log(
              `Academy ${academy.id} Connect status: charges_enabled=${account.charges_enabled}`,
            );
          }
        }
        break;
      }

      case "customer.subscription.created": {
        await this.handleConnectSubscriptionCreated(event.data.object);
        break;
      }

      case "invoice.payment_failed": {
        await this.handleInvoicePaymentFailed(event.data.object);
        break;
      }
    }

    return { received: true };
  }

  private async handleConnectSubscriptionCreated(subscription: {
    id: string;
    metadata?: Record<string, string>;
    customer?: string | { id: string };
    current_period_start?: number;
    current_period_end?: number;
  }) {
    const studentId = subscription.metadata?.studentId;
    const academyPlanId = subscription.metadata?.academyPlanId;
    const academyId = subscription.metadata?.academyId;

    if (studentId && academyPlanId && academyId) {
      const sub = await this.studentSubscriptionRepo.findOne({
        where: { studentId, academyPlanId, academyId },
        order: { createdAt: "DESC" },
      });
      if (sub) {
        sub.stripeSubscriptionId = subscription.id;
        sub.stripeCustomerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id ?? null;
        sub.status = StudentSubscriptionStatus.ACTIVE;
        if (subscription.current_period_start) {
          sub.currentPeriodStart = new Date(subscription.current_period_start * 1000);
        }
        if (subscription.current_period_end) {
          sub.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
        }
        await this.studentSubscriptionRepo.save(sub);
        this.logger.log(`StudentSubscription ${sub.id} confirmed via webhook`);
      }
    }
  }

  private async handleConnectSubscriptionDeleted(subscription: {
    id: string;
    metadata?: Record<string, string>;
  }) {
    const sub = await this.studentSubscriptionRepo.findOne({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (sub) {
      sub.status = StudentSubscriptionStatus.CANCELLED;
      sub.cancelledAt = new Date();
      await this.studentSubscriptionRepo.save(sub);
      this.logger.log(`StudentSubscription ${sub.id} cancelled via webhook`);
    }
  }

  private async handleInvoicePaymentFailed(invoice: {
    subscription?: string | null;
  }) {
    if (!invoice.subscription) return;
    const subscriptionId =
      typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription;

    const sub = await this.studentSubscriptionRepo.findOne({
      where: { stripeSubscriptionId: subscriptionId },
    });
    if (sub) {
      sub.status = StudentSubscriptionStatus.PAST_DUE;
      await this.studentSubscriptionRepo.save(sub);
      this.logger.log(`StudentSubscription ${sub.id} marked as past_due`);
    }
  }
}
