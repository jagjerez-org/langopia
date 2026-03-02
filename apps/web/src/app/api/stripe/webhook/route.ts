import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { User } from "@/entities";
import { UserPlan } from "@langopia/shared/types";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = getStripe();
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const ds = await getDataSource();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan;

      if (userId && plan) {
        const user = await ds.getRepository(User).findOne({
          where: { id: userId },
        });
        if (user) {
          user.plan = plan as UserPlan;
          user.stripeSubscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : null;
          await ds.getRepository(User).save(user);
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
        const user = await ds.getRepository(User).findOne({
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
          await ds.getRepository(User).save(user);
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
        const user = await ds.getRepository(User).findOne({
          where: { stripeCustomerId: customerId },
        });
        if (user) {
          user.plan = UserPlan.FREE;
          user.stripeSubscriptionId = null;
          await ds.getRepository(User).save(user);
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
