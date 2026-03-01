import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataSource } from "@/lib/database";
import { Classroom, ClassroomEnrollment } from "@/entities";
import { UserRole, ClassroomType } from "@langopia/shared/types";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ds = await getDataSource();
  const classroomRepo = ds.getRepository(Classroom);

  const role = session.user.role as UserRole;

  if (role === UserRole.ADMIN) {
    const classrooms = await classroomRepo.find({
      where: { academyId: session.user.academyId! },
      relations: ["teacher"],
      order: { createdAt: "DESC" },
    });
    return NextResponse.json(classrooms);
  }

  if (role === UserRole.TEACHER) {
    const classrooms = await classroomRepo.find({
      where: { teacherId: session.user.id },
      order: { createdAt: "DESC" },
    });
    return NextResponse.json(classrooms);
  }

  // Student: return classrooms they're enrolled in
  const enrollmentRepo = ds.getRepository(ClassroomEnrollment);
  const enrollments = await enrollmentRepo.find({
    where: { studentId: session.user.id },
    relations: ["classroom", "classroom.teacher"],
  });
  const classrooms = enrollments.map((e) => e.classroom);
  return NextResponse.json(classrooms);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role as UserRole;
  if (role !== UserRole.TEACHER && role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, description, type, languageTarget, maxStudents } = await req.json();

  if (!name || !languageTarget) {
    return NextResponse.json(
      { error: "Name and languageTarget are required" },
      { status: 400 }
    );
  }

  const ds = await getDataSource();
  const classroomRepo = ds.getRepository(Classroom);

  const classroom = classroomRepo.create({
    name,
    description: description || null,
    type: type || ClassroomType.ONE_TO_ONE,
    languageTarget,
    maxStudents: maxStudents || (type === ClassroomType.GROUP ? 10 : 1),
    teacherId: session.user.id,
    academyId: session.user.academyId!,
  });

  await classroomRepo.save(classroom);

  return NextResponse.json(classroom, { status: 201 });
}
