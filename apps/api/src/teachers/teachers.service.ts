import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Teacher } from "../database/entities/teacher.entity.js";
import { User } from "../database/entities/user.entity.js";
import { Class } from "../database/entities/class.entity.js";
import { ClassStudent } from "../database/entities/class-student.entity.js";
import { Student } from "../database/entities/student.entity.js";
import { ClassReport } from "../database/entities/class-report.entity.js";
import { EmailService } from "../email/email.service.js";

@Injectable()
export class TeachersService {
  constructor(
    @InjectRepository(Teacher)
    private readonly teacherRepo: Repository<Teacher>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Class)
    private readonly classRepo: Repository<Class>,
    @InjectRepository(ClassStudent)
    private readonly classStudentRepo: Repository<ClassStudent>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(ClassReport)
    private readonly classReportRepo: Repository<ClassReport>,
    private readonly emailService: EmailService,
  ) {}

  async listTeachers(academyId: string) {
    const teachers = await this.teacherRepo.find({
      where: { academyId },
      order: { createdAt: "DESC" },
    });

    return {
      data: teachers.map((t) => ({
        id: t.id,
        name: t.name,
        email: t.email,
        languages: t.languages,
        isActive: t.isActive,
        userId: t.userId,
        createdAt: t.createdAt,
      })),
    };
  }

  async getTeacherDetail(academyId: string, id: string) {
    const teacher = await this.teacherRepo.findOne({
      where: { id, academyId },
    });

    if (!teacher) {
      throw new NotFoundException("Teacher not found");
    }

    // KPIs from classes — broken down by status
    const statusCounts: { status: string; cnt: string; mins: string }[] = await this.classRepo
      .createQueryBuilder("c")
      .select("c.status", "status")
      .addSelect("COUNT(c.id)", "cnt")
      .addSelect("COALESCE(SUM(c.durationMinutes), 0)", "mins")
      .where("c.teacherId = :teacherId", { teacherId: id })
      .andWhere("c.academyId = :academyId", { academyId })
      .groupBy("c.status")
      .getRawMany();

    let totalClasses = 0;
    let totalMinutes = 0;
    let completedClasses = 0;
    let cancelledClasses = 0;
    for (const row of statusCounts) {
      const cnt = Number(row.cnt);
      totalClasses += cnt;
      totalMinutes += Number(row.mins);
      if (row.status === "completed") completedClasses = cnt;
      if (row.status === "cancelled") cancelledClasses = cnt;
    }

    const uniqueStudentsResult = await this.classStudentRepo
      .createQueryBuilder("cs")
      .innerJoin("cs.class_", "c")
      .select("COUNT(DISTINCT cs.studentId)", "count")
      .where("c.teacherId = :teacherId", { teacherId: id })
      .andWhere("c.academyId = :academyId", { academyId })
      .getRawOne();

    // No-show rate
    const noShowResult = await this.classStudentRepo
      .createQueryBuilder("cs")
      .innerJoin("cs.class_", "c")
      .select("COUNT(*) FILTER (WHERE cs.status = 'no_show')", "noShows")
      .addSelect("COUNT(*)", "total")
      .where("c.teacherId = :teacherId", { teacherId: id })
      .andWhere("c.academyId = :academyId", { academyId })
      .getRawOne();

    // Languages taught
    const languageRows: { language: string }[] = await this.classRepo
      .createQueryBuilder("c")
      .select("DISTINCT c.language", "language")
      .where("c.teacherId = :teacherId", { teacherId: id })
      .andWhere("c.academyId = :academyId", { academyId })
      .getRawMany();

    // Last class date
    const lastClass = await this.classRepo
      .createQueryBuilder("c")
      .select("c.scheduledAt", "scheduledAt")
      .where("c.teacherId = :teacherId", { teacherId: id })
      .andWhere("c.academyId = :academyId", { academyId })
      .orderBy("c.scheduledAt", "DESC")
      .limit(1)
      .getRawOne();

    // Recent classes with student names
    const recentClasses = await this.classRepo
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.classStudents", "cs")
      .leftJoin("cs.student", "student")
      .addSelect(["student.name"])
      .where("c.teacherId = :teacherId", { teacherId: id })
      .andWhere("c.academyId = :academyId", { academyId })
      .orderBy("c.scheduledAt", "DESC")
      .take(20)
      .getMany();

    // Monthly hours: last 6 months, zero-filled
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyRows: { month: string; minutes: string }[] = await this.classRepo
      .createQueryBuilder("c")
      .select("TO_CHAR(c.scheduledAt, 'Mon YY')", "month")
      .addSelect("COALESCE(SUM(c.durationMinutes), 0)", "minutes")
      .where("c.teacherId = :teacherId", { teacherId: id })
      .andWhere("c.academyId = :academyId", { academyId })
      .andWhere("c.scheduledAt >= :since", { since: sixMonthsAgo })
      .groupBy("TO_CHAR(c.scheduledAt, 'Mon YY')")
      .addGroupBy("DATE_TRUNC('month', c.scheduledAt)")
      .orderBy("DATE_TRUNC('month', c.scheduledAt)", "ASC")
      .getRawMany();

    const monthlyHours: { month: string; hours: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
      const found = monthlyRows.find((r) => r.month.trim() === label);
      monthlyHours.push({
        month: label,
        hours: found ? Math.round(Number(found.minutes) / 60) : 0,
      });
    }

    // Weekly activity: last 8 weeks
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    const weeklyRows: { week: string; count: string }[] = await this.classRepo
      .createQueryBuilder("c")
      .select("TO_CHAR(c.scheduledAt, 'IYYY-IW')", "week")
      .addSelect("COUNT(*)", "count")
      .where("c.teacherId = :teacherId", { teacherId: id })
      .andWhere("c.academyId = :academyId", { academyId })
      .andWhere("c.scheduledAt >= :since", { since: eightWeeksAgo })
      .groupBy("TO_CHAR(c.scheduledAt, 'IYYY-IW')")
      .orderBy("week", "ASC")
      .getRawMany();

    const weeklyActivity: { week: string; classes: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      const isoYear = d.getFullYear();
      const jan4 = new Date(isoYear, 0, 4);
      const dayDiff = (d.getTime() - jan4.getTime()) / 86400000;
      const weekNum = Math.ceil((dayDiff + jan4.getDay() + 1) / 7);
      const key = `${isoYear}-${String(weekNum).padStart(2, "0")}`;
      const found = weeklyRows.find((r) => r.week === key);
      weeklyActivity.push({
        week: `W${8 - i}`,
        classes: found ? Number(found.count) : 0,
      });
    }

    // Student level distribution
    const levelRows: { level: string; count: string }[] = await this.classStudentRepo
      .createQueryBuilder("cs")
      .innerJoin("cs.class_", "c")
      .innerJoin("cs.student", "student")
      .select("COALESCE(student.cefrEstimate, 'Unknown')", "level")
      .addSelect("COUNT(DISTINCT cs.studentId)", "count")
      .where("c.teacherId = :teacherId", { teacherId: id })
      .andWhere("c.academyId = :academyId", { academyId })
      .groupBy("COALESCE(student.cefrEstimate, 'Unknown')")
      .getRawMany();

    // AI reports count
    const roomIds = recentClasses
      .map((c) => c.roomId)
      .filter((rid): rid is string => rid !== null);

    let aiReportsCount = 0;
    if (roomIds.length > 0) {
      const countResult = await this.classReportRepo
        .createQueryBuilder("cr")
        .select("COUNT(*)", "count")
        .where("cr.roomId IN (:...roomIds)", { roomIds })
        .andWhere("cr.status = :status", { status: "completed" })
        .getRawOne();
      aiReportsCount = Number(countResult?.count ?? 0);
    }

    const avgDuration = totalClasses > 0 ? Math.round(totalMinutes / totalClasses) : 0;
    const cancelRate = totalClasses > 0 ? Math.round((cancelledClasses / totalClasses) * 100) : 0;
    const noShowTotal = Number(noShowResult?.total ?? 0);
    const noShowCount = Number(noShowResult?.noShows ?? 0);
    const noShowRate = noShowTotal > 0 ? Math.round((noShowCount / noShowTotal) * 100) : 0;

    return {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      languages: teacher.languages,
      isActive: teacher.isActive,
      userId: teacher.userId,
      createdAt: teacher.createdAt,
      totalClasses,
      totalMinutes,
      completedClasses,
      cancelledClasses,
      cancelRate,
      avgDuration,
      uniqueStudents: Number(uniqueStudentsResult?.count ?? 0),
      noShowRate,
      languagesTaught: languageRows.map((r) => r.language),
      lastClassAt: lastClass?.scheduledAt ?? null,
      aiReportsCount,
      recentClasses: recentClasses.map((c) => ({
        classId: c.id,
        title: c.title,
        scheduledAt: c.scheduledAt,
        durationMinutes: c.durationMinutes,
        status: c.status,
        classType: c.classType,
        students: (c.classStudents ?? []).map((cs) => cs.student?.name ?? "Unknown").join(", "),
        language: c.language,
      })),
      monthlyHours,
      weeklyActivity,
      studentLevelDistribution: levelRows.map((r) => ({
        level: r.level,
        count: Number(r.count),
      })),
    };
  }

  async inviteTeacher(academyId: string, academyName: string, email: string) {
    // Check if teacher already exists in this academy
    let teacher = await this.teacherRepo.findOne({
      where: { academyId, email },
    });

    if (teacher) {
      if (!teacher.isActive) {
        teacher.isActive = true;
        await this.teacherRepo.save(teacher);
      }
      return {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        languages: teacher.languages,
        isActive: teacher.isActive,
      };
    }

    // Find user by email (optional — teacher may not have a User account)
    const user = await this.userRepo.findOne({ where: { email } });

    teacher = new Teacher();
    teacher.academyId = academyId;
    teacher.email = email;
    teacher.name = user?.name ?? email.split("@")[0];
    teacher.userId = user?.id ?? null;
    teacher.languages = [];
    teacher = await this.teacherRepo.save(teacher);

    // Send invitation email (fire-and-forget)
    this.emailService
      .sendTeacherInvitation({
        to: email,
        teacherName: teacher.name,
        academyName,
      })
      .catch(() => {});

    return {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      languages: teacher.languages,
      isActive: teacher.isActive,
    };
  }

  async removeTeacher(academyId: string, id: string) {
    const teacher = await this.teacherRepo.findOne({
      where: { id, academyId },
    });

    if (!teacher) {
      throw new NotFoundException("Teacher not found");
    }

    // Check if teacher has any classes
    const classCount = await this.classRepo.count({
      where: { teacherId: id, academyId },
    });

    if (classCount > 0) {
      throw new BadRequestException(
        "This teacher has classes assigned. Use deactivate instead.",
      );
    }

    await this.teacherRepo.remove(teacher);

    return { success: true };
  }

  async deactivateTeacher(academyId: string, id: string) {
    const teacher = await this.teacherRepo.findOne({
      where: { id, academyId },
    });

    if (!teacher) {
      throw new NotFoundException("Teacher not found");
    }

    teacher.isActive = false;
    await this.teacherRepo.save(teacher);

    return { id: teacher.id, isActive: teacher.isActive };
  }

  async reactivateTeacher(academyId: string, id: string) {
    const teacher = await this.teacherRepo.findOne({
      where: { id, academyId },
    });

    if (!teacher) {
      throw new NotFoundException("Teacher not found");
    }

    teacher.isActive = true;
    await this.teacherRepo.save(teacher);

    return { id: teacher.id, isActive: teacher.isActive };
  }
}
