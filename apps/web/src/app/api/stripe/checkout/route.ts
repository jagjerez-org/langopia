import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataSource } from "@/lib/database";
import { Academy } from "@/entities";
import { UserRole } from "@langopia/shared/types";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role as UserRole;
  if (role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { priceId } = await req.json();
  if (!priceId) {
    return NextResponse.json({ error: "priceId is required" }, { status: 400 });
  }

  const ds = await getDataSource();
  const academy = await ds.getRepository(Academy).findOne({
    where: { id: session.user.academyId! },
  });

  if (!academy) {
    return NextResponse.json({ error: "Academy not found" }, { status: 404 });
  }

  // Create or reuse Stripe customer
  let customerId = academy.stripeCustomerId;
  if (!customerId) {
    const customer = await getStripe().customers.create({
      email: session.user.email,
      name: academy.name,
      metadata: { academyId: academy.id },
    });
    customerId = customer.id;
    academy.stripeCustomerId = customerId;
    await ds.getRepository(Academy).save(academy);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const checkoutSession = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/settings?billing=success`,
    cancel_url: `${appUrl}/settings?billing=cancelled`,
    metadata: { academyId: academy.id },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
