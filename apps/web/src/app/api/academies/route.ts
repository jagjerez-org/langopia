import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/auth";
import { getDataSource } from "@/lib/database";
import { Academy, AcademyMember, User } from "@/entities";
import { PLAN_LIMITS, UserPlan } from "@langopia/shared/types";

// GET /api/academies - List user's academies
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ds = await getDataSource();
  const memberships = await ds.getRepository(AcademyMember).find({
    where: { userId: session.user.id },
    relations: ["academy"],
    order: { joinedAt: "ASC" },
  });

  return NextResponse.json(
    memberships.map((m) => ({
      id: m.academy.id,
      name: m.academy.name,
      slug: m.academy.slug,
      role: m.roles.includes("owner") ? "owner" : m.roles[0],
      roles: m.roles,
      academyType: m.academy.academyType,
      apiKey: m.roles.includes("owner") ? m.academy.apiKey : undefined,
      createdAt: m.academy.createdAt,
    }))
  );
}

// POST /api/academies - Create a new academy
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ds = await getDataSource();

  // Check plan limit for academies
  const user = await ds.getRepository(User).findOne({ where: { id: session.user.id } });
  const plan = user?.plan ?? UserPlan.FREE;
  const limits = PLAN_LIMITS[plan];

  const currentCount = await ds.getRepository(AcademyMember)
    .createQueryBuilder("m")
    .where("m.userId = :userId", { userId: session.user.id })
    .andWhere("m.roles @> :roles", { roles: JSON.stringify(["owner"]) })
    .getCount();

  if (currentCount >= limits.maxAcademies) {
    return NextResponse.json(
      { error: `Academy limit reached (${currentCount}/${limits.maxAcademies}). Upgrade your plan.` },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { name, academyType } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const apiKey = `lgo_${crypto.randomBytes(32).toString("hex")}`;

  const academy = new Academy();
  academy.name = name;
  academy.slug = `${slug}-${crypto.randomBytes(4).toString("hex")}`;
  academy.apiKey = apiKey;
  academy.academyType = academyType || "academy";

  const saved = await ds.getRepository(Academy).save(academy);

  // Create owner membership
  const member = new AcademyMember();
  member.userId = session.user.id;
  member.academyId = saved.id;
  member.roles = ["owner"];
  await ds.getRepository(AcademyMember).save(member);

  return NextResponse.json(
    {
      id: saved.id,
      name: saved.name,
      slug: saved.slug,
      apiKey: saved.apiKey,
      role: "owner",
      roles: ["owner"],
      academyType: saved.academyType,
      createdAt: saved.createdAt,
    },
    { status: 201 }
  );
}
