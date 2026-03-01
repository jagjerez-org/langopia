import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDataSource } from "@/lib/database";
import {
  User,
  Classroom,
  Session,
  ClassReport,
  ClassroomEnrollment,
  LearningProfile,
  ProgressReport,
} from "@/entities";
import { UserRole, SessionStatus } from "@langopia/shared/types";
import { Between, MoreThanOrEqual } from "typeorm";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ds = await getDataSource();
  const role = session.user.role as UserRole;
  const academyId = session.user.academyId;

  if (role === UserRole.ADMIN) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [totalUsers, activeClassrooms, sessionsToday, reportsThisMonth] =
      await Promise.all([
        ds.getRepository(User).count(
          academyId ? { where: { academyId, isActive: true } } : { where: { isActive: true } }
        ),
        ds.getRepository(Classroom).count(
          academyId ? { where: { academyId } } : undefined
        ),
        ds.getRepository(Session).count({
          where: {
            ...(academyId ? { academyId } : {}),
            scheduledAt: Between(todayStart, todayEnd),
          },
        }),
        ds.getRepository(ClassReport).count({
          where: {
            ...(academyId ? { academyId } : {}),
            createdAt: MoreThanOrEqual(monthStart),
          },
        }),
      ]);

    return NextResponse.json({
      totalUsers,
      activeClassrooms,
      sessionsToday,
      reportsThisMonth,
    });
  }

  if (role === UserRole.TEACHER) {
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    const [myClassrooms, upcomingSessions, totalStudents, pendingReports] =
      await Promise.all([
        ds.getRepository(Classroom).count({
          where: { teacherId: session.user.id },
        }),
        ds.getRepository(Session).count({
          where: {
            classroom: { teacherId: session.user.id },
            status: SessionStatus.SCHEDULED,
            scheduledAt: Between(new Date(), weekFromNow),
          },
        }),
        ds.getRepository(ClassroomEnrollment).count({
          where: { classroom: { teacherId: session.user.id } },
        }),
        // Count completed sessions without reports
        ds
          .getRepository(Session)
          .createQueryBuilder("s")
          .innerJoin("s.classroom", "c")
          .leftJoin("s.classReport", "r")
          .where("c.teacherId = :teacherId", { teacherId: session.user.id })
          .andWhere("s.status = :status", { status: SessionStatus.COMPLETED })
          .andWhere("r.id IS NULL")
          .getCount(),
      ]);

    return NextResponse.json({
      myClassrooms,
      upcomingSessions,
      totalStudents,
      pendingReports,
    });
  }

  // Student
  const [myClasses, nextSessionResult, profile, reportsCount] =
    await Promise.all([
      ds.getRepository(ClassroomEnrollment).count({
        where: { studentId: session.user.id },
      }),
      ds
        .getRepository(Session)
        .createQueryBuilder("s")
        .innerJoin("s.classroom", "c")
        .innerJoin("c.enrollments", "e")
        .where("e.studentId = :studentId", { studentId: session.user.id })
        .andWhere("s.status = :status", { status: SessionStatus.SCHEDULED })
        .andWhere("s.scheduledAt >= :now", { now: new Date() })
        .orderBy("s.scheduledAt", "ASC")
        .getOne(),
      ds.getRepository(LearningProfile).findOne({
        where: { studentId: session.user.id },
      }),
      ds.getRepository(ProgressReport).count({
        where: { studentId: session.user.id },
      }),
    ]);

  return NextResponse.json({
    myClasses,
    nextSession: nextSessionResult
      ? new Date(nextSessionResult.scheduledAt).toLocaleDateString()
      : null,
    cefrLevel: profile?.cefrLevelEstimate ?? null,
    reportsCount,
  });
}
