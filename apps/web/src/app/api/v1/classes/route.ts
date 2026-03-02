import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDataSource } from "@/lib/database";
import { Class, ClassStudent, AcademyMember, Student, Lesson, User } from "@/entities";
import { UsageMetric } from "@langopia/shared/types";
import { authenticateApiKey, incrementUsage, checkPlanLimit } from "@/lib/api-auth";
import { sendClassScheduled } from "@/lib/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// POST /api/v1/classes - Create/book a class
export async function POST(req: NextRequest) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy, ownerId } = authResult;
  const ds = await getDataSource();

  // Check plan limits
  const owner = await ds.getRepository(User).findOne({ where: { id: ownerId } });
  if (!owner) {
    return NextResponse.json({ error: "Owner not found" }, { status: 500 });
  }

  const limitCheck = await checkPlanLimit(ownerId, owner.plan, UsageMetric.ROOMS_CREATED);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { error: `Class limit reached (${limitCheck.current}/${limitCheck.limit}). Upgrade your plan.` },
      { status: 403 }
    );
  }

  const body = await req.json();
  const {
    title,
    description,
    scheduledAt,
    durationMinutes,
    classType,
    language,
    maxStudents,
    lessonId,
    teacherId,
    studentEmails,
    cancellationMinutes,
  } = body;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!scheduledAt) {
    return NextResponse.json({ error: "scheduledAt is required" }, { status: 400 });
  }

  // Validate lessonId if provided
  if (lessonId) {
    const lesson = await ds.getRepository(Lesson).findOne({
      where: { id: lessonId, academyId: academy.id },
    });
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found or belongs to a different academy" }, { status: 400 });
    }
  }

  // Resolve teacherId
  let resolvedTeacherId: string | null = teacherId ?? null;

  if (teacherId) {
    // Validate teacherId is an AcademyMember with teacher role
    const teacherMember = await ds.getRepository(AcademyMember)
      .createQueryBuilder("m")
      .where("m.id = :id", { id: teacherId })
      .andWhere("m.academyId = :academyId", { academyId: academy.id })
      .andWhere("m.roles @> :roles", { roles: JSON.stringify(["teacher"]) })
      .getOne();
    if (!teacherMember) {
      return NextResponse.json({ error: "Teacher not found or not a teacher in this academy" }, { status: 400 });
    }
  } else if (academy.academyType === "freelance") {
    // Freelance: auto-assign owner as teacher
    const ownerMember = await ds.getRepository(AcademyMember)
      .createQueryBuilder("m")
      .where("m.academyId = :academyId", { academyId: academy.id })
      .andWhere("m.roles @> :roles", { roles: JSON.stringify(["owner"]) })
      .getOne();
    if (ownerMember) {
      resolvedTeacherId = ownerMember.id;
    }
  }

  // Generate tokens
  const teacherToken = "t_" + crypto.randomBytes(24).toString("hex");
  const studentToken = "s_" + crypto.randomBytes(24).toString("hex");

  // Create class (no Room yet — created on-demand when teacher joins)
  const cls = new Class();
  cls.academyId = academy.id;
  cls.createdByUserId = ownerId;
  cls.title = title;
  cls.description = description ?? null;
  cls.classType = classType ?? "individual";
  cls.maxStudents = maxStudents ?? 1;
  cls.language = language ?? "en";
  cls.lessonId = lessonId ?? null;
  cls.teacherId = resolvedTeacherId;
  cls.status = "scheduled";
  cls.scheduledAt = new Date(scheduledAt);
  cls.durationMinutes = durationMinutes ?? 60;
  cls.cancellationMinutes = cancellationMinutes ?? 60;
  cls.teacherToken = teacherToken;
  cls.studentToken = studentToken;

  const saved = await ds.getRepository(Class).save(cls);

  // Find/create Students from studentEmails and create ClassStudent entries
  const students: { id: string; email: string; name: string }[] = [];
  if (Array.isArray(studentEmails) && studentEmails.length > 0) {
    for (const email of studentEmails) {
      if (typeof email !== "string" || !email.includes("@")) continue;
      let student = await ds.getRepository(Student).findOne({
        where: { academyId: academy.id, email },
      });
      if (!student) {
        student = new Student();
        student.academyId = academy.id;
        student.email = email;
        student.name = email.split("@")[0];
        student = await ds.getRepository(Student).save(student);
      }

      const cs = new ClassStudent();
      cs.classId = saved.id;
      cs.studentId = student.id;
      cs.status = "enrolled";
      await ds.getRepository(ClassStudent).save(cs);

      students.push({ id: student.id, email: student.email, name: student.name });
    }
  }

  // Track usage
  await incrementUsage(ownerId, academy.id, UsageMetric.ROOMS_CREATED);

  // Load teacher info for response
  let teacherInfo = null;
  if (resolvedTeacherId) {
    const tm = await ds.getRepository(AcademyMember).findOne({
      where: { id: resolvedTeacherId },
      relations: ["user"],
    });
    if (tm) {
      teacherInfo = { id: tm.id, name: tm.user.name, email: tm.user.email };
    }
  }

  // Fire-and-forget: send email notifications
  const teacherUrl = `${APP_URL}/class/${saved.id}?token=${teacherToken}`;
  const studentUrl = `${APP_URL}/class/${saved.id}?token=${studentToken}`;

  if (teacherInfo?.email) {
    sendClassScheduled({
      to: teacherInfo.email,
      classTitle: saved.title,
      scheduledAt: saved.scheduledAt,
      durationMinutes: saved.durationMinutes,
      joinUrl: teacherUrl,
    }).catch(() => {});
  }
  for (const s of students) {
    sendClassScheduled({
      to: s.email,
      classTitle: saved.title,
      scheduledAt: saved.scheduledAt,
      durationMinutes: saved.durationMinutes,
      teacherName: teacherInfo?.name,
      joinUrl: studentUrl,
    }).catch(() => {});
  }

  return NextResponse.json(
    {
      id: saved.id,
      title: saved.title,
      description: saved.description,
      classType: saved.classType,
      status: saved.status,
      language: saved.language,
      maxStudents: saved.maxStudents,
      scheduledAt: saved.scheduledAt,
      durationMinutes: saved.durationMinutes,
      cancellationMinutes: saved.cancellationMinutes,
      teacherUrl,
      studentUrl,
      teacher: teacherInfo,
      students,
      lessonId: saved.lessonId,
      createdAt: saved.createdAt,
    },
    { status: 201 }
  );
}

// GET /api/v1/classes - List classes
export async function GET(req: NextRequest) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const ds = await getDataSource();

  const status = req.nextUrl.searchParams.get("status");
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const teacherIdFilter = req.nextUrl.searchParams.get("teacherId");
  const classTypeFilter = req.nextUrl.searchParams.get("classType");
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(req.nextUrl.searchParams.get("offset") ?? "0");

  const qb = ds.getRepository(Class)
    .createQueryBuilder("cls")
    .leftJoinAndSelect("cls.teacher", "teacher")
    .leftJoin("teacher.user", "teacherUser")
    .addSelect(["teacherUser.name", "teacherUser.email"])
    .where("cls.academyId = :academyId", { academyId: academy.id })
    .orderBy("cls.scheduledAt", "DESC")
    .take(limit)
    .skip(offset);

  if (status) {
    qb.andWhere("cls.status = :status", { status });
  }
  if (from) {
    qb.andWhere("cls.scheduledAt >= :from", { from: new Date(from) });
  }
  if (to) {
    qb.andWhere("cls.scheduledAt <= :to", { to: new Date(to) });
  }
  if (teacherIdFilter) {
    qb.andWhere("cls.teacherId = :teacherId", { teacherId: teacherIdFilter });
  }
  if (classTypeFilter) {
    qb.andWhere("cls.classType = :classType", { classType: classTypeFilter });
  }

  const [classes, total] = await qb.getManyAndCount();

  return NextResponse.json({
    data: classes.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      classType: c.classType,
      status: c.status,
      language: c.language,
      maxStudents: c.maxStudents,
      scheduledAt: c.scheduledAt,
      durationMinutes: c.durationMinutes,
      teacher: c.teacher ? { id: c.teacher.id, name: c.teacher.user?.name, email: c.teacher.user?.email } : null,
      teacherUrl: `${APP_URL}/class/${c.id}?token=${c.teacherToken}`,
      studentUrl: `${APP_URL}/class/${c.id}?token=${c.studentToken}`,
      roomId: c.roomId,
      lessonId: c.lessonId,
      createdAt: c.createdAt,
    })),
    total,
    limit,
    offset,
  });
}
