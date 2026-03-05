import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";

@Injectable()
export class StripeClientService {
  private stripeInstance: Stripe | null = null;

  readonly PLAN_PRICE_IDS: Record<string, string>;

  constructor(private readonly config: ConfigService) {
    this.PLAN_PRICE_IDS = {
      starter:
        this.config.get("STRIPE_STARTER_PRICE_ID") ?? "price_starter",
      professional:
        this.config.get("STRIPE_PROFESSIONAL_PRICE_ID") ??
        "price_professional",
    };
  }

  getStripe(): Stripe {
    if (!this.stripeInstance) {
      const key = this.config.getOrThrow<string>("STRIPE_SECRET_KEY");
      this.stripeInstance = new Stripe(key, {
        apiVersion: "2025-01-27.acacia" as Stripe.LatestApiVersion,
      });
    }
    return this.stripeInstance;
  }
}
