import Stripe from "stripe";
import { AcademyPlan } from "@langopia/shared/types";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      typescript: true,
    });
  }
  return stripeClient;
}

// Map Stripe price lookup keys to academy plans.
// Configure these in your Stripe dashboard using lookup_key on prices.
export const PLAN_PRICE_MAP: Record<string, AcademyPlan> = {
  starter: AcademyPlan.STARTER,
  professional: AcademyPlan.PROFESSIONAL,
  enterprise: AcademyPlan.ENTERPRISE,
};
