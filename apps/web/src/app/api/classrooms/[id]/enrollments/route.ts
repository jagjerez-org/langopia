import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataSource } from "@/lib/database";
import { Classroom, ClassroomEnrollment, User } from "@/entities";
import { UserRole } from "@langopia/shared/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ds = await getDataSource();
  const enrollments = await ds.getRepository(ClassroomEnrollment).find({
    where: { classroomId: id },
    relations: ["student"],
    order: { enrolledAt: "DESC" },
  });

  return NextResponse.json(enrollments);
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
  const { studentId } = await req.json();

  if (!studentId) {
    return NextResponse.json({ error: "studentId is required" }, { status: 400 });
  }

  const ds = await getDataSource();
  const classroom = await ds.getRepository(Classroom).findOne({ where: { id } });
  if (!classroom) {
    return NextResponse.json({ error: "Classroom not found" }, { status: 404 });
  }

  if (role !== UserRole.ADMIN && classroom.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const student = await ds.getRepository(User).findOne({ where: { id: studentId } });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const enrollmentRepo = ds.getRepository(ClassroomEnrollment);

  const existing = await enrollmentRepo.findOne({
    where: { classroomId: id, studentId },
  });
  if (existing) {
    return NextResponse.json({ error: "Student already enrolled" }, { status: 409 });
  }

  const currentCount = await enrollmentRepo.count({ where: { classroomId: id } });
  if (currentCount >= classroom.maxStudents) {
    return NextResponse.json({ error: "Classroom is full" }, { status: 409 });
  }

  const enrollment = enrollmentRepo.create({ classroomId: id, studentId });
  await enrollmentRepo.save(enrollment);

  return NextResponse.json(enrollment, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role as UserRole;
  if (role !== UserRole.TEACHER && role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { studentId } = await req.json();

  if (!studentId) {
    return NextResponse.json({ error: "studentId is required" }, { status: 400 });
  }

  const ds = await getDataSource();
  const classroom = await ds.getRepository(Classroom).findOne({ where: { id } });
  if (!classroom) {
    return NextResponse.json({ error: "Classroom not found" }, { status: 404 });
  }

  if (role !== UserRole.ADMIN && classroom.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const enrollmentRepo = ds.getRepository(ClassroomEnrollment);
  const enrollment = await enrollmentRepo.findOne({
    where: { classroomId: id, studentId },
  });

  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  await enrollmentRepo.remove(enrollment);

  return NextResponse.json({ success: true });
}
