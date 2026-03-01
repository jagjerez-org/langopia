import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataSource } from "@/lib/database";
import { Classroom } from "@/entities";
import { UserRole } from "@langopia/shared/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ds = await getDataSource();
  const classroom = await ds.getRepository(Classroom).findOne({
    where: { id },
    relations: ["teacher", "enrollments", "enrollments.student"],
  });

  if (!classroom) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(classroom);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ds = await getDataSource();
  const classroomRepo = ds.getRepository(Classroom);
  const classroom = await classroomRepo.findOne({ where: { id } });

  if (!classroom) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const role = session.user.role as UserRole;
  if (role !== UserRole.ADMIN && classroom.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, description, type, languageTarget, maxStudents } = body;

  if (name !== undefined) classroom.name = name;
  if (description !== undefined) classroom.description = description;
  if (type !== undefined) classroom.type = type;
  if (languageTarget !== undefined) classroom.languageTarget = languageTarget;
  if (maxStudents !== undefined) classroom.maxStudents = maxStudents;

  await classroomRepo.save(classroom);

  return NextResponse.json(classroom);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ds = await getDataSource();
  const classroomRepo = ds.getRepository(Classroom);
  const classroom = await classroomRepo.findOne({ where: { id } });

  if (!classroom) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const role = session.user.role as UserRole;
  if (role !== UserRole.ADMIN && classroom.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await classroomRepo.remove(classroom);

  return NextResponse.json({ success: true });
}
