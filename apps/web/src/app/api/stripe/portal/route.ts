import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataSource } from "@/lib/database";
import { Academy } from "@/entities";
import { UserRole } from "@langopia/shared/types";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role as UserRole;
  if (role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ds = await getDataSource();
  const academy = await ds.getRepository(Academy).findOne({
    where: { id: session.user.academyId! },
  });

  if (!academy?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account found" },
      { status: 400 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const portalSession = await getStripe().billingPortal.sessions.create({
    customer: academy.stripeCustomerId,
    return_url: `${appUrl}/settings`,
  });

  return NextResponse.json({ url: portalSession.url });
}
