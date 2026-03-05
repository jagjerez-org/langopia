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
import { StripeClientService } from "../stripe-client/stripe-client.service.js";
import { UserPlan } from "@langopia/shared/types";

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
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
        break;
      }
    }

    return { received: true };
  }
}
