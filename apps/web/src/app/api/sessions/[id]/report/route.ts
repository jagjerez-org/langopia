import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataSource } from "@/lib/database";
import { Session, ClassReport, ClassroomEnrollment } from "@/entities";
import { UserRole } from "@langopia/shared/types";
import { runBatchAnalysis } from "@/lib/batch-analysis";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ds = await getDataSource();

  const sessionEntity = await ds.getRepository(Session).findOne({
    where: { id },
    relations: ["classroom"],
  });

  if (!sessionEntity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Auth: teacher, enrolled student, or admin
  const role = session.user.role as UserRole;
  const isTeacher = sessionEntity.classroom.teacherId === session.user.id;

  if (!isTeacher && role !== UserRole.ADMIN) {
    const enrollment = await ds.getRepository(ClassroomEnrollment).findOne({
      where: { classroomId: sessionEntity.classroomId, studentId: session.user.id },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const report = await ds.getRepository(ClassReport).findOne({
    where: { sessionId: id },
  });

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  return NextResponse.json(report);
}

export async function POST(_req: NextRequest, { params }: Params) {
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

  const sessionEntity = await ds.getRepository(Session).findOne({
    where: { id },
    relations: ["classroom"],
  });

  if (!sessionEntity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (role !== UserRole.ADMIN && sessionEntity.classroom.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Run analysis (will skip if report already exists)
  try {
    await runBatchAnalysis(id);
  } catch (err) {
    console.error("Analysis failed:", err);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }

  const report = await ds.getRepository(ClassReport).findOne({
    where: { sessionId: id },
  });

  if (!report) {
    return NextResponse.json({ error: "Report generation failed" }, { status: 500 });
  }

  return NextResponse.json(report, { status: 201 });
}
