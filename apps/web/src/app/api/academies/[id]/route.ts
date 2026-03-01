import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataSource } from "@/lib/database";
import { Academy } from "@/entities";
import { UserRole } from "@langopia/shared/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ds = await getDataSource();
  const academyRepo = ds.getRepository(Academy);
  const academy = await academyRepo.findOne({
    where: { id },
    relations: ["users", "classrooms"],
  });

  if (!academy) {
    return NextResponse.json({ error: "Academy not found" }, { status: 404 });
  }

  return NextResponse.json(academy);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const ds = await getDataSource();
  const academyRepo = ds.getRepository(Academy);
  const academy = await academyRepo.findOne({ where: { id } });

  if (!academy) {
    return NextResponse.json({ error: "Academy not found" }, { status: 404 });
  }

  Object.assign(academy, body);
  await academyRepo.save(academy);

  return NextResponse.json(academy);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ds = await getDataSource();
  const academyRepo = ds.getRepository(Academy);
  const academy = await academyRepo.findOne({ where: { id } });

  if (!academy) {
    return NextResponse.json({ error: "Academy not found" }, { status: 404 });
  }

  await academyRepo.remove(academy);

  return NextResponse.json({ message: "Academy deleted" });
}
