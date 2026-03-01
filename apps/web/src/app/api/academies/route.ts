import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataSource } from "@/lib/database";
import { Academy } from "@/entities";
import { UserRole, AcademyPlan } from "@langopia/shared/types";
import { slugify } from "@langopia/shared/utils";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ds = await getDataSource();
  const academyRepo = ds.getRepository(Academy);
  const academies = await academyRepo.find({
    order: { createdAt: "DESC" },
  });

  return NextResponse.json(academies);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, timezone } = await req.json();

  if (!name) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
  }

  const ds = await getDataSource();
  const academyRepo = ds.getRepository(Academy);

  const slug = slugify(name);
  const existingAcademy = await academyRepo.findOne({ where: { slug } });
  if (existingAcademy) {
    return NextResponse.json(
      { error: "An academy with this name already exists" },
      { status: 409 }
    );
  }

  const academy = academyRepo.create({
    name,
    slug,
    plan: AcademyPlan.FREE,
    timezone: timezone || "UTC",
    settings: {},
  });

  await academyRepo.save(academy);

  return NextResponse.json(academy, { status: 201 });
}
