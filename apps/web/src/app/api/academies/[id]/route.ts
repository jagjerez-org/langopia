import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/auth";
import { getDataSource } from "@/lib/database";
import { Academy, AcademyMember } from "@/entities";
import { hasPermission, Permission } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// GET /api/academies/:id - Get academy details
export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ds = await getDataSource();

  const membership = await ds.getRepository(AcademyMember).findOne({
    where: { userId: session.user.id, academyId: id },
    relations: ["academy"],
  });

  if (!membership) {
    return NextResponse.json({ error: "Academy not found" }, { status: 404 });
  }

  const memberCount = await ds.getRepository(AcademyMember).count({
    where: { academyId: id },
  });

  return NextResponse.json({
    id: membership.academy.id,
    name: membership.academy.name,
    slug: membership.academy.slug,
    role: membership.roles.includes("owner") ? "owner" : membership.roles[0],
    roles: membership.roles,
    academyType: membership.academy.academyType,
    apiKey: membership.roles.includes("owner") ? membership.academy.apiKey : undefined,
    settings: membership.academy.settings,
    memberCount,
    createdAt: membership.academy.createdAt,
  });
}

// PATCH /api/academies/:id - Update academy
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ds = await getDataSource();

  const membership = await ds.getRepository(AcademyMember).findOne({
    where: { userId: session.user.id, academyId: id },
    relations: ["academy"],
  });

  if (!membership) {
    return NextResponse.json({ error: "Academy not found" }, { status: 404 });
  }

  if (!hasPermission(membership.roles, Permission.MANAGE_SETTINGS)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await req.json();
  const { name, settings } = body;

  if (name) membership.academy.name = name;
  if (settings) membership.academy.settings = { ...membership.academy.settings, ...settings };

  await ds.getRepository(Academy).save(membership.academy);

  return NextResponse.json({
    id: membership.academy.id,
    name: membership.academy.name,
    slug: membership.academy.slug,
    settings: membership.academy.settings,
  });
}

// POST /api/academies/:id/regenerate-key - Regenerate API key
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ds = await getDataSource();

  const membership = await ds.getRepository(AcademyMember).findOne({
    where: { userId: session.user.id, academyId: id },
    relations: ["academy"],
  });

  if (!membership || !membership.roles.includes("owner")) {
    return NextResponse.json({ error: "Only the owner can regenerate the API key" }, { status: 403 });
  }

  membership.academy.apiKey = `lgo_${crypto.randomBytes(32).toString("hex")}`;
  await ds.getRepository(Academy).save(membership.academy);

  return NextResponse.json({
    apiKey: membership.academy.apiKey,
  });
}
