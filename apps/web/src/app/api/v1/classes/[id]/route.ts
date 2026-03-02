import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Class, ClassStudent, AcademyMember, Lesson } from "@/entities";
import { authenticateApiKey } from "@/lib/api-auth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

type Params = { params: Promise<{ id: string }> };

// GET /api/v1/classes/:id - Get class detail
export async function GET(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  const cls = await ds.getRepository(Class).findOne({
    where: { id, academyId: academy.id },
    relations: ["teacher", "teacher.user", "lesson", "room"],
  });

  if (!cls) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const classStudents = await ds.getRepository(ClassStudent).find({
    where: { classId: cls.id },
    relations: ["student"],
  });

  return NextResponse.json({
    id: cls.id,
    title: cls.title,
    description: cls.description,
    classType: cls.classType,
    status: cls.status,
    language: cls.language,
    maxStudents: cls.maxStudents,
    scheduledAt: cls.scheduledAt,
    durationMinutes: cls.durationMinutes,
    cancellationMinutes: cls.cancellationMinutes,
    cancelledAt: cls.cancelledAt,
    cancelReason: cls.cancelReason,
    teacher: cls.teacher
      ? { id: cls.teacher.id, name: cls.teacher.user?.name, email: cls.teacher.user?.email }
      : null,
    students: classStudents.map((cs) => ({
      id: cs.student.id,
      email: cs.student.email,
      name: cs.student.name,
      status: cs.status,
    })),
    lesson: cls.lesson
      ? { id: cls.lesson.id, title: cls.lesson.title }
      : null,
    room: cls.room
      ? { id: cls.room.id, status: cls.room.status }
      : null,
    teacherUrl: `${APP_URL}/class/${cls.id}?token=${cls.teacherToken}`,
    studentUrl: `${APP_URL}/class/${cls.id}?token=${cls.studentToken}`,
    createdAt: cls.createdAt,
    updatedAt: cls.updatedAt,
  });
}

// PATCH /api/v1/classes/:id - Update a class
export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  const cls = await ds.getRepository(Class).findOne({
    where: { id, academyId: academy.id },
  });

  if (!cls) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  if (cls.status !== "scheduled" && cls.status !== "confirmed") {
    return NextResponse.json(
      { error: "Can only update classes with status scheduled or confirmed" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { title, description, scheduledAt, durationMinutes, lessonId, teacherId, maxStudents } = body;

  if (title !== undefined) cls.title = title;
  if (description !== undefined) cls.description = description;
  if (scheduledAt !== undefined) cls.scheduledAt = new Date(scheduledAt);
  if (durationMinutes !== undefined) cls.durationMinutes = durationMinutes;
  if (maxStudents !== undefined) cls.maxStudents = maxStudents;

  if (lessonId !== undefined) {
    if (lessonId) {
      const lesson = await ds.getRepository(Lesson).findOne({
        where: { id: lessonId, academyId: academy.id },
      });
      if (!lesson) {
        return NextResponse.json({ error: "Lesson not found" }, { status: 400 });
      }
    }
    cls.lessonId = lessonId;
  }

  if (teacherId !== undefined) {
    if (teacherId) {
      const teacherMember = await ds.getRepository(AcademyMember)
        .createQueryBuilder("m")
        .where("m.id = :id", { id: teacherId })
        .andWhere("m.academyId = :academyId", { academyId: academy.id })
        .andWhere("m.roles @> :roles", { roles: JSON.stringify(["teacher"]) })
        .getOne();
      if (!teacherMember) {
        return NextResponse.json({ error: "Teacher not found" }, { status: 400 });
      }
    }
    cls.teacherId = teacherId;
  }

  const saved = await ds.getRepository(Class).save(cls);

  return NextResponse.json({
    id: saved.id,
    title: saved.title,
    description: saved.description,
    status: saved.status,
    scheduledAt: saved.scheduledAt,
    durationMinutes: saved.durationMinutes,
    maxStudents: saved.maxStudents,
    lessonId: saved.lessonId,
    teacherId: saved.teacherId,
    updatedAt: saved.updatedAt,
  });
}

// DELETE /api/v1/classes/:id - Delete a class
export async function DELETE(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  const cls = await ds.getRepository(Class).findOne({
    where: { id, academyId: academy.id },
  });

  if (!cls) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  if (cls.status !== "scheduled" && cls.status !== "confirmed") {
    return NextResponse.json(
      { error: "Can only delete classes with status scheduled or confirmed" },
      { status: 400 }
    );
  }

  // ClassStudents are CASCADE deleted
  await ds.getRepository(Class).remove(cls);

  return NextResponse.json({ success: true });
}
