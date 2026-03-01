import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataSource } from "@/lib/database";
import { Classroom, Session, ClassroomEnrollment } from "@/entities";
import { UserRole, SessionStatus } from "@langopia/shared/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ds = await getDataSource();

  // Verify user has access to this classroom
  const role = session.user.role as UserRole;
  const classroom = await ds.getRepository(Classroom).findOne({ where: { id } });
  if (!classroom) {
    return NextResponse.json({ error: "Classroom not found" }, { status: 404 });
  }

  if (role === UserRole.STUDENT) {
    const enrollment = await ds.getRepository(ClassroomEnrollment).findOne({
      where: { classroomId: id, studentId: session.user.id },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (role === UserRole.TEACHER && classroom.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sessions = await ds.getRepository(Session).find({
    where: { classroomId: id },
    order: { scheduledAt: "DESC" },
  });

  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role as UserRole;
  if (role !== UserRole.TEACHER && role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const ds = await getDataSource();
  const classroom = await ds.getRepository(Classroom).findOne({ where: { id } });

  if (!classroom) {
    return NextResponse.json({ error: "Classroom not found" }, { status: 404 });
  }

  if (role !== UserRole.ADMIN && classroom.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { scheduledAt } = await req.json();
  if (!scheduledAt) {
    return NextResponse.json({ error: "scheduledAt is required" }, { status: 400 });
  }

  const sessionRepo = ds.getRepository(Session);
  const newSession = sessionRepo.create({
    classroomId: id,
    academyId: classroom.academyId,
    scheduledAt: new Date(scheduledAt),
    status: SessionStatus.SCHEDULED,
  });

  await sessionRepo.save(newSession);

  return NextResponse.json(newSession, { status: 201 });
}
