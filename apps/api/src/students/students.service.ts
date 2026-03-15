import { Injectable, ConflictException, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Student } from "../database/entities/student.entity.js";
import { RoomParticipant } from "../database/entities/room-participant.entity.js";
import { ReportExercise } from "../database/entities/report-exercise.entity.js";
import { Class } from "../database/entities/class.entity.js";
import { ClassStudent } from "../database/entities/class-student.entity.js";
import { ClassReport } from "../database/entities/class-report.entity.js";
import { StudentSubscription } from "../database/entities/student-subscription.entity.js";
import { StudyStreak } from "../database/entities/study-streak.entity.js";
import { DailyActivity } from "../database/entities/daily-activity.entity.js";
import type { CreateStudentDto } from "./dto/create-student.dto.js";

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(RoomParticipant)
    private readonly participantRepo: Repository<RoomParticipant>,
    @InjectRepository(ReportExercise)
    private readonly reportExerciseRepo: Repository<ReportExercise>,
    @InjectRepository(Class)
    private readonly classRepo: Repository<Class>,
    @InjectRepository(ClassStudent)
    private readonly classStudentRepo: Repository<ClassStudent>,
    @InjectRepository(ClassReport)
    private readonly classReportRepo: Repository<ClassReport>,
    @InjectRepository(StudentSubscription)
    private readonly subscriptionRepo: Repository<StudentSubscription>,
    @InjectRepository(StudyStreak)
    private readonly streakRepo: Repository<StudyStreak>,
    @InjectRepository(DailyActivity)
    private readonly dailyRepo: Repository<DailyActivity>,
  ) {}

  async createStudent(academyId: string, dto: CreateStudentDto) {
    const existing = await this.studentRepo.findOne({
      where: { academyId, email: dto.email },
    });

    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        existing.name = dto.name;
        if (dto.cefrEstimate !== undefined) {
          existing.cefrEstimate = dto.cefrEstimate ?? null;
        }
        await this.studentRepo.save(existing);
        return existing;
      }
      throw new ConflictException("A student with this email already exists in this academy");
    }

    const student = this.studentRepo.create({
      academyId,
      email: dto.email,
      name: dto.name,
      cefrEstimate: dto.cefrEstimate ?? null,
    });

    return this.studentRepo.save(student);
  }

  async listStudents(
    academyId: string,
    opts: { search?: string; limit: number; offset: number; includeInactive?: boolean },
  ) {
    const { search, limit, offset } = opts;

    const qb = this.studentRepo
      .createQueryBuilder("student")
      .where("student.academyId = :academyId", { academyId })
      .orderBy("student.lastSeenAt", "DESC")
      .take(limit)
      .skip(offset);

    if (opts.includeInactive !== true) {
      qb.andWhere("student.isActive = :isActive", { isActive: true });
    }

    if (search) {
      qb.andWhere(
        "(student.name ILIKE :search OR student.email ILIKE :search)",
        { search: `%${search}%` },
      );
    }

    const [students, total] = await qb.getManyAndCount();

    return {
      data: students.map((s) => ({
        id: s.id,
        email: s.email,
        name: s.name,
        totalRooms: s.totalRooms,
        totalMinutes: s.totalMinutes,
        cefrEstimate: s.cefrEstimate,
        isActive: s.isActive,
        firstSeenAt: s.firstSeenAt,
        lastSeenAt: s.lastSeenAt,
      })),
      total,
      limit,
      offset,
    };
  }

  async getStudentDetail(academyId: string, id: string) {
    const student = await this.studentRepo.findOne({
      where: { id, academyId },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    // Get class history with teacher names
    const classHistoryRows = await this.classStudentRepo
      .createQueryBuilder("cs")
      .innerJoinAndSelect("cs.class_", "c")
      .leftJoin("c.teacher", "teacher")
      .leftJoin("teacher.user", "teacherUser")
      .addSelect(["teacher.id", "teacherUser.name"])
      .where("cs.studentId = :studentId", { studentId: id })
      .andWhere("c.academyId = :academyId", { academyId })
      .orderBy("c.scheduledAt", "DESC")
      .take(50)
      .getMany();

    const classHistory = classHistoryRows.map((cs) => ({
      classId: cs.class_.id,
      title: cs.class_.title,
      scheduledAt: cs.class_.scheduledAt,
      durationMinutes: cs.class_.durationMinutes,
      status: cs.status,
      teacherName: cs.class_.teacher?.user?.name ?? null,
      language: cs.class_.language,
    }));

    // Unique teachers from class history
    const teacherSet = new Map<string, string>();
    for (const cs of classHistoryRows) {
      const name = cs.class_.teacher?.user?.name;
      const tid = cs.class_.teacher?.id;
      if (tid && name) teacherSet.set(tid, name);
    }
    const teachers = Array.from(teacherSet.entries()).map(([tid, name]) => ({ id: tid, name }));

    // Weekly activity: last 8 weeks, zero-filled
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    const weeklyRows: { week: string; count: string }[] = await this.classStudentRepo
      .createQueryBuilder("cs")
      .innerJoin("cs.class_", "c")
      .select("TO_CHAR(c.scheduledAt, 'IYYY-IW')", "week")
      .addSelect("COUNT(*)", "count")
      .where("cs.studentId = :studentId", { studentId: id })
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

    // AI Reports: find ClassReports where this student appears in studentReports JSONB
    const roomIds = classHistoryRows
      .map((cs) => cs.class_.roomId)
      .filter((rid): rid is string => rid !== null);

    let aiReports: {
      reportId: string;
      roomId: string;
      roomTitle: string | null;
      summary: string | null;
      speakingTime: number;
      speakingRatio: number;
      fillerWords: number;
      vocabularyCount: number;
      grammarErrorCount: number;
      createdAt: Date;
    }[] = [];

    if (roomIds.length > 0) {
      const reports = await this.classReportRepo
        .createQueryBuilder("cr")
        .leftJoinAndSelect("cr.room", "room")
        .where("cr.roomId IN (:...roomIds)", { roomIds })
        .andWhere("cr.status = :status", { status: "completed" })
        .orderBy("cr.createdAt", "DESC")
        .take(20)
        .getMany();

      aiReports = reports
        .map((r) => {
          const studentReport = r.studentReports?.find((sr) => sr.studentId === id);
          if (!studentReport) return null;
          return {
            reportId: r.id,
            roomId: r.roomId,
            roomTitle: r.room?.title ?? null,
            summary: r.summary,
            speakingTime: studentReport.speakingTime,
            speakingRatio: studentReport.speakingRatio,
            fillerWords: studentReport.fillerWords,
            vocabularyCount: studentReport.vocabulary?.length ?? 0,
            grammarErrorCount: studentReport.grammarErrors?.length ?? 0,
            createdAt: r.createdAt,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
    }

    // Subscriptions with plan details
    const subscriptions = await this.subscriptionRepo.find({
      where: { studentId: id, academyId },
      relations: ["academyPlan"],
      order: { createdAt: "DESC" },
    });

    const activeSubscription = subscriptions.find((s) => s.status === "active") ?? null;

    // Participation stats (speaking time, last connection)
    const participations = await this.participantRepo.find({
      where: { studentId: id },
      relations: ["room"],
      order: { joinedAt: "DESC" },
      take: 50,
    });

    const totalSpeakingSeconds = participations.reduce(
      (sum, p) => sum + (p.speakingTimeSeconds ?? 0),
      0,
    );
    const lastConnection = participations[0]?.joinedAt ?? null;

    // Exercises
    const reportExercises = await this.reportExerciseRepo.find({
      where: { studentId: id },
      relations: ["exercise"],
      order: { createdAt: "DESC" },
      take: 50,
    });

    // Attended classes count
    const attendedCount = classHistoryRows.filter((cs) => cs.status === "attended").length;

    // Streak + XP
    const [streak, totalXpResult] = await Promise.all([
      this.streakRepo.findOne({ where: { studentId: id } }),
      this.dailyRepo
        .createQueryBuilder("da")
        .select("COALESCE(SUM(da.xpEarned), 0)", "total")
        .where("da.studentId = :studentId", { studentId: id })
        .getRawOne(),
    ]);

    return {
      id: student.id,
      email: student.email,
      name: student.name,
      totalRooms: student.totalRooms,
      totalMinutes: student.totalMinutes,
      cefrEstimate: student.cefrEstimate,
      firstSeenAt: student.firstSeenAt,
      isActive: student.isActive,
      lastSeenAt: student.lastSeenAt,
      lastConnection,
      totalSpeakingSeconds,
      attendedClasses: attendedCount,
      streak: streak
        ? { currentStreak: streak.currentStreak, longestStreak: streak.longestStreak, totalActivityDays: streak.totalActivityDays }
        : null,
      totalXp: parseInt(totalXpResult?.total || "0"),
      nativeLanguage: student.nativeLanguage,
      learningLanguage: student.learningLanguage,
      selfAssessedLevel: student.selfAssessedLevel,
      learningGoal: student.learningGoal,
      occupation: student.occupation,
      interests: student.interests,
      dailyGoalMinutes: student.dailyGoalMinutes,
      onboardingCompleted: student.onboardingCompleted,
      teachers,
      classHistory,
      weeklyActivity,
      aiReports,
      activeSubscription: activeSubscription
        ? {
            id: activeSubscription.id,
            planName: activeSubscription.academyPlan?.name ?? "Unknown",
            planPrice: activeSubscription.academyPlan?.price ?? 0,
            currency: activeSubscription.academyPlan?.currency ?? "EUR",
            periodicity: activeSubscription.academyPlan?.periodicity ?? null,
            status: activeSubscription.status,
            currentPeriodStart: activeSubscription.currentPeriodStart,
            currentPeriodEnd: activeSubscription.currentPeriodEnd,
            createdAt: activeSubscription.createdAt,
          }
        : null,
      subscriptionHistory: subscriptions.map((s) => ({
        id: s.id,
        planName: s.academyPlan?.name ?? "Unknown",
        planPrice: s.academyPlan?.price ?? 0,
        currency: s.academyPlan?.currency ?? "EUR",
        status: s.status,
        createdAt: s.createdAt,
        cancelledAt: s.cancelledAt,
      })),
      exercises: reportExercises.map((re) => ({
        id: re.exercise?.id,
        type: re.exercise?.type,
        targetSkill: re.exercise?.targetSkill,
        topic: re.exercise?.topic,
        cefrLevel: re.exercise?.cefrLevel,
        source: re.exercise?.source,
        isCompleted: re.isCompleted,
        isCorrect: re.isCorrect,
        studentAnswer: re.studentAnswer,
        reportId: re.reportId,
        createdAt: re.createdAt,
      })),
    };
  }

  async setActive(academyId: string, id: string, isActive: boolean) {
    const student = await this.studentRepo.findOne({
      where: { id, academyId },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    student.isActive = isActive;
    await this.studentRepo.save(student);

    return { id: student.id, isActive: student.isActive };
  }
}
