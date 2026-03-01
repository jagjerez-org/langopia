import { NextRequest, NextResponse } from "next/server";
import { getStripe, PLAN_PRICE_MAP } from "@/lib/stripe";
import { getDataSource } from "@/lib/database";
import { Academy } from "@/entities";
import { AcademyPlan } from "@langopia/shared/types";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const ds = await getDataSource();
  const academyRepo = ds.getRepository(Academy);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const academyId = session.metadata?.academyId;
      if (academyId && session.subscription) {
        const academy = await academyRepo.findOne({ where: { id: academyId } });
        if (academy) {
          academy.stripeSubscriptionId = session.subscription as string;
          await academyRepo.save(academy);
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;
      const academy = await academyRepo.findOne({
        where: { stripeCustomerId: customerId },
      });
      if (academy) {
        // Determine plan from the price
        const priceId = subscription.items.data[0]?.price?.lookup_key;
        const plan = priceId ? PLAN_PRICE_MAP[priceId] : null;
        if (plan) {
          academy.plan = plan;
        }
        academy.stripeSubscriptionId = subscription.id;
        await academyRepo.save(academy);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;
      const academy = await academyRepo.findOne({
        where: { stripeCustomerId: customerId },
      });
      if (academy) {
        academy.plan = AcademyPlan.FREE;
        academy.stripeSubscriptionId = null;
        await academyRepo.save(academy);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
