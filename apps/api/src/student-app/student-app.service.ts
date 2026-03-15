import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, LessThanOrEqual } from "typeorm";
import * as bcrypt from "bcryptjs";
import { UserType, CourseStatus, CEFR_LEVELS } from "@langopia/shared/types";
import {
  User,
  Academy,
  Student,
  StudyStreak,
  DailyActivity,
  ReviewItem,
  LessonProgress,
  CourseProgress,
  StudentProgress,
  Class,
  ClassStudent,
  ClassReport,
  Course,
  CourseLesson,
  Exercise,
  LessonExercise,
  StudentLearningPath,
  StudentLearningPathCourse,
} from "../database/entities/index.js";
import { StudentRegisterDto } from "./dto/student-register.dto.js";
import { StudentLoginDto } from "./dto/student-login.dto.js";
import { StudentOnboardingDto } from "./dto/student-onboarding.dto.js";
import { SwitchLanguageDto } from "./dto/switch-language.dto.js";
import { SubmitExerciseDto } from "./dto/submit-exercise.dto.js";
import { SubmitReviewDto } from "./dto/submit-review.dto.js";
import { UpdateStudentProfileDto } from "./dto/update-profile.dto.js";
import { UpdatePreferencesDto } from "./dto/update-preferences.dto.js";

@Injectable()
export class StudentAppService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Academy) private readonly academyRepo: Repository<Academy>,
    @InjectRepository(Student) private readonly studentRepo: Repository<Student>,
    @InjectRepository(StudyStreak) private readonly streakRepo: Repository<StudyStreak>,
    @InjectRepository(DailyActivity) private readonly dailyRepo: Repository<DailyActivity>,
    @InjectRepository(ReviewItem) private readonly reviewRepo: Repository<ReviewItem>,
    @InjectRepository(LessonProgress) private readonly lessonProgressRepo: Repository<LessonProgress>,
    @InjectRepository(CourseProgress) private readonly courseProgressRepo: Repository<CourseProgress>,
    @InjectRepository(StudentProgress) private readonly progressRepo: Repository<StudentProgress>,
    @InjectRepository(Class) private readonly classRepo: Repository<Class>,
    @InjectRepository(ClassStudent) private readonly classStudentRepo: Repository<ClassStudent>,
    @InjectRepository(ClassReport) private readonly reportRepo: Repository<ClassReport>,
    @InjectRepository(Course) private readonly courseRepo: Repository<Course>,
    @InjectRepository(CourseLesson) private readonly courseLessonRepo: Repository<CourseLesson>,
    @InjectRepository(Exercise) private readonly exerciseRepo: Repository<Exercise>,
    @InjectRepository(LessonExercise) private readonly lessonExerciseRepo: Repository<LessonExercise>,
    @InjectRepository(StudentLearningPath) private readonly slpRepo: Repository<StudentLearningPath>,
    @InjectRepository(StudentLearningPathCourse) private readonly slpCourseRepo: Repository<StudentLearningPathCourse>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Auth ────────────────────────────────────────────

  async resolveAcademy(slug: string) {
    const academy = await this.academyRepo.findOne({
      where: { slug },
      select: ["id", "name", "slug", "logoUrl", "academyType", "settings"],
    });
    if (!academy) throw new NotFoundException("Academy not found");
    return academy;
  }

  async register(dto: StudentRegisterDto) {
    const academy = await this.academyRepo.findOne({ where: { id: dto.academyId } });
    if (!academy) throw new NotFoundException("Academy not found");

    return this.dataSource.transaction(async (manager) => {
      const existingUser = await manager.findOne(User, { where: { email: dto.email } });

      let user: User;

      if (existingUser) {
        // Reuse existing user (staff or otherwise) — just verify no duplicate student
        const existingStudent = await manager.findOne(Student, {
          where: { academyId: dto.academyId, email: dto.email, userId: existingUser.id },
        });
        if (existingStudent?.onboardingCompleted) {
          throw new ConflictException("Already registered as a student in this academy");
        }

        // Update password if they don't have one (e.g. Google OAuth user)
        if (!existingUser.passwordHash) {
          existingUser.passwordHash = await bcrypt.hash(dto.password, 10);
          await manager.save(existingUser);
        }

        user = existingUser;
      } else {
        // Create new user
        const passwordHash = await bcrypt.hash(dto.password, 10);
        user = manager.create(User, {
          email: dto.email,
          name: dto.name,
          passwordHash,
          userType: UserType.STUDENT,
        });
        await manager.save(user);
      }

      // Find or create student record
      let student = await manager.findOne(Student, {
        where: { academyId: dto.academyId, email: dto.email },
      });

      if (student) {
        student.userId = user.id;
        student.name = dto.name;
        student.isActive = true;
        await manager.save(student);
      } else {
        student = manager.create(Student, {
          academyId: dto.academyId,
          email: dto.email,
          name: dto.name,
          userId: user.id,
          isActive: true,
        });
        await manager.save(student);
      }

      // Create streak record if it doesn't exist
      const existingStreak = await manager.findOne(StudyStreak, { where: { studentId: student.id } });
      if (!existingStreak) {
        const streak = manager.create(StudyStreak, { studentId: student.id });
        await manager.save(streak);
      }

      const tokens = this.generateStudentTokens(user, student);

      return {
        ...tokens,
        user: { id: user.id, email: user.email, name: user.name },
        student: { id: student.id, academyId: student.academyId },
      };
    });
  }

  async login(dto: StudentLoginDto) {
    const student = await this.studentRepo.findOne({
      where: { academyId: dto.academyId, email: dto.email },
    });
    if (!student || !student.userId) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const user = await this.userRepo.findOne({ where: { id: student.userId } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Invalid credentials");
    if (!user.isActive) throw new UnauthorizedException("Account is disabled");
    if (!student.isActive) throw new UnauthorizedException("Student account is inactive");

    user.lastLoginAt = new Date();
    await this.userRepo.save(user);

    const tokens = this.generateStudentTokens(user, student);
    return {
      ...tokens,
      user: { id: user.id, email: user.email, name: user.name },
      student: {
        id: student.id,
        academyId: student.academyId,
        onboardingCompleted: student.onboardingCompleted,
      },
    };
  }

  private generateStudentTokens(user: User, student: Student) {
    const payload = {
      sub: user.id,
      email: user.email,
      studentId: student.id,
      academyId: student.academyId,
    };

    const accessToken = this.jwtService.sign(
      { ...payload, type: "access" },
      { expiresIn: this.configService.get("JWT_EXPIRATION", "6h") },
    );

    const refreshToken = this.jwtService.sign(
      { ...payload, type: "refresh" },
      { expiresIn: this.configService.get("JWT_REFRESH_EXPIRATION", "7d") },
    );

    return { accessToken, refreshToken };
  }

  // ─── Onboarding ──────────────────────────────────────

  async saveOnboarding(studentId: string, dto: StudentOnboardingDto) {
    await this.studentRepo.update(studentId, {
      nativeLanguage: dto.nativeLanguage,
      learningLanguage: dto.learningLanguage,
      selfAssessedLevel: dto.selfAssessedLevel,
      learningGoal: dto.learningGoal,
      occupation: dto.occupation,
      interests: dto.interests || [],
      dailyGoalMinutes: dto.dailyGoalMinutes || 15,
      timezone: dto.timezone,
      onboardingCompleted: true,
    });
    return { success: true };
  }

  async switchLanguage(studentId: string, dto: SwitchLanguageDto) {
    await this.studentRepo.update(studentId, {
      learningLanguage: dto.learningLanguage,
    });
    // Delete existing SLP so it regenerates lazily for new language
    await this.slpRepo.delete({ studentId });
    return { success: true };
  }

  // ─── Home ────────────────────────────────────────────

  async getHome(student: Student) {
    const today = new Date().toISOString().split("T")[0];

    const [streak, todayActivity, reviewDueCount, nextClass] = await Promise.all([
      this.streakRepo.findOne({ where: { studentId: student.id } }),
      this.dailyRepo.findOne({ where: { studentId: student.id, activityDate: today } }),
      this.reviewRepo.count({
        where: {
          studentId: student.id,
          isRetired: false,
          nextReviewDate: LessThanOrEqual(today),
        },
      }),
      this.classStudentRepo
        .createQueryBuilder("cs")
        .innerJoinAndSelect("cs.class_", "c")
        .where("cs.studentId = :studentId", { studentId: student.id })
        .andWhere("c.status IN (:...statuses)", { statuses: ["scheduled", "confirmed"] })
        .andWhere("c.scheduledAt > :now", { now: new Date() })
        .orderBy("c.scheduledAt", "ASC")
        .getOne(),
    ]);

    // Get continue lesson (last in-progress)
    const continueLesson = await this.lessonProgressRepo
      .createQueryBuilder("lp")
      .innerJoinAndSelect("lp.lesson", "l")
      .where("lp.studentId = :studentId", { studentId: student.id })
      .andWhere("lp.status = :status", { status: "in_progress" })
      .orderBy("lp.lastExerciseIndex", "DESC")
      .getOne();

    // If no in-progress lesson, recommend a course matching student's language/level
    let recommendedCourse: { id: string; title: string; level: string | null } | null = null;
    if (!continueLesson) {
      const qb = this.courseRepo
        .createQueryBuilder("c")
        .where("c.academyId = :academyId", { academyId: student.academyId })
        .andWhere("c.status = :status", { status: CourseStatus.PUBLISHED });

      if (student.learningLanguage) {
        qb.andWhere("LOWER(c.language) = LOWER(:lang)", { lang: student.learningLanguage });
      }

      // Prefer courses at the student's level
      if (student.selfAssessedLevel) {
        qb.orderBy(
          `CASE WHEN UPPER(c.cefrLevel) = UPPER(:level) THEN 0 ELSE 1 END`,
          "ASC",
        ).setParameter("level", student.selfAssessedLevel);
        qb.addOrderBy("c.createdAt", "DESC");
      } else {
        qb.orderBy("c.createdAt", "DESC");
      }

      const course = await qb.getOne();
      if (course) {
        // Only recommend if the student hasn't completed it
        const progress = await this.courseProgressRepo.findOne({
          where: { studentId: student.id, courseId: course.id },
        });
        if (!progress || progress.status !== "completed") {
          recommendedCourse = { id: course.id, title: course.title, level: course.cefrLevel };
        }
      }
    }

    return {
      streak: streak || { currentStreak: 0, longestStreak: 0, freezesAvailable: 1 },
      today: todayActivity || { exercisesCompleted: 0, minutesPracticed: 0, xpEarned: 0 },
      reviewDueCount,
      dailyGoalMinutes: student.dailyGoalMinutes,
      nextClass: nextClass
        ? {
            id: nextClass.class_.id,
            title: nextClass.class_.title,
            scheduledAt: nextClass.class_.scheduledAt,
          }
        : null,
      continueLesson: continueLesson
        ? {
            lessonId: continueLesson.lessonId,
            title: continueLesson.lesson.title,
            completedExercises: continueLesson.completedExercises,
            totalExercises: continueLesson.totalExercises,
            lastExerciseIndex: continueLesson.lastExerciseIndex,
          }
        : null,
      recommendedCourse,
    };
  }

  // ─── Study ───────────────────────────────────────────

  async getCourses(student: Student) {
    const qb = this.courseRepo
      .createQueryBuilder("c")
      .where("c.academyId = :academyId", { academyId: student.academyId })
      .andWhere("c.status = :status", { status: CourseStatus.PUBLISHED });

    // Filter by student's learning language if set
    if (student.learningLanguage) {
      qb.andWhere("LOWER(c.language) = LOWER(:lang)", { lang: student.learningLanguage });
    }

    qb.orderBy("c.createdAt", "DESC");

    const courses = await qb.getMany();

    const courseIds = courses.map((c) => c.id);
    const progress = courseIds.length
      ? await this.courseProgressRepo
          .createQueryBuilder("cp")
          .where("cp.studentId = :studentId", { studentId: student.id })
          .andWhere("cp.courseId IN (:...courseIds)", { courseIds })
          .getMany()
      : [];

    const progressMap = new Map(progress.map((p) => [p.courseId, p]));

    return courses.map((course) => {
      const p = progressMap.get(course.id);
      return {
        id: course.id,
        title: course.title,
        description: course.description,
        language: course.language,
        level: course.cefrLevel,
        status: p?.status || "not_started",
        completedLessons: p?.completedLessons || 0,
        totalLessons: p?.totalLessons || 0,
      };
    });
  }

  async getCourseDetail(student: Student, courseId: string) {
    const course = await this.courseRepo.findOne({
      where: { id: courseId, academyId: student.academyId },
    });
    if (!course) throw new NotFoundException("Course not found");

    const courseLessons = await this.courseLessonRepo.find({
      where: { courseId },
      relations: ["lesson"],
      order: { sortOrder: "ASC" },
    });

    const lessonIds = courseLessons.map((cl) => cl.lessonId);
    const lessonProgress = lessonIds.length
      ? await this.lessonProgressRepo
          .createQueryBuilder("lp")
          .where("lp.studentId = :studentId", { studentId: student.id })
          .andWhere("lp.lessonId IN (:...lessonIds)", { lessonIds })
          .getMany()
      : [];

    const progressMap = new Map(lessonProgress.map((p) => [p.lessonId, p]));

    return {
      id: course.id,
      title: course.title,
      description: course.description,
      language: course.language,
      level: course.cefrLevel,
      lessons: courseLessons.map((cl) => {
        const p = progressMap.get(cl.lessonId);
        return {
          id: cl.lesson.id,
          title: cl.lesson.title,
          module: cl.moduleTitle,
          orderIndex: cl.sortOrder,
          status: p?.status || "not_started",
          completedExercises: p?.completedExercises || 0,
          totalExercises: p?.totalExercises || 0,
        };
      }),
    };
  }

  async getLessonForRunner(student: Student, lessonId: string) {
    const exercises = await this.lessonExerciseRepo.find({
      where: { lessonId },
      relations: ["exercise"],
      order: { sortOrder: "ASC" },
    });

    if (!exercises.length) throw new NotFoundException("Lesson not found or has no exercises");

    let progress = await this.lessonProgressRepo.findOne({
      where: { studentId: student.id, lessonId },
    });

    if (!progress) {
      progress = this.lessonProgressRepo.create({
        studentId: student.id,
        lessonId,
        totalExercises: exercises.length,
        status: "in_progress",
      });
      await this.lessonProgressRepo.save(progress);
    }

    return {
      lessonId,
      progress: {
        completedExercises: progress.completedExercises,
        totalExercises: progress.totalExercises,
        lastExerciseIndex: progress.lastExerciseIndex,
        status: progress.status,
      },
      exercises: exercises.map((le) => ({
        id: le.exercise.id,
        type: le.exercise.type,
        title: le.exercise.title,
        content: le.exercise.content,
        orderIndex: le.sortOrder,
      })),
    };
  }

  // ─── Exercise Submission ─────────────────────────────

  async submitExercise(student: Student, exerciseId: string, dto: SubmitExerciseDto) {
    const exercise = await this.exerciseRepo.findOne({ where: { id: exerciseId } });
    if (!exercise) throw new NotFoundException("Exercise not found");

    // Record progress
    const attempt = this.progressRepo.create({
      studentId: student.id,
      exerciseId,
      lessonId: dto.lessonId || null,
      isCompleted: true,
      isCorrect: dto.isCorrect ?? null,
      studentAnswer: dto.answer || null,
      timeSpentSeconds: dto.timeSpentSeconds,
      source: dto.lessonId ? "lesson" : "practice",
    });
    await this.progressRepo.save(attempt);

    // Update lesson progress if in a lesson
    if (dto.lessonId) {
      const lp = await this.lessonProgressRepo.findOne({
        where: { studentId: student.id, lessonId: dto.lessonId },
      });
      if (lp) {
        lp.completedExercises += 1;
        lp.lastExerciseIndex = lp.completedExercises;
        if (lp.completedExercises >= lp.totalExercises) {
          lp.status = "completed";
          lp.completedAt = new Date();
        }
        await this.lessonProgressRepo.save(lp);
      }
    }

    // XP: 10 per exercise
    const xp = 10;
    await this.recordActivity(student.id, { exercisesCompleted: 1, xpEarned: xp, minutesPracticed: Math.ceil(dto.timeSpentSeconds / 60) });

    return { xp, isCorrect: dto.isCorrect };
  }

  async completeLesson(student: Student, lessonId: string) {
    const lp = await this.lessonProgressRepo.findOne({
      where: { studentId: student.id, lessonId },
    });
    if (!lp) throw new NotFoundException("Lesson progress not found");

    lp.status = "completed";
    lp.completedAt = new Date();
    lp.completedExercises = lp.totalExercises;
    await this.lessonProgressRepo.save(lp);

    // XP bonus: 50 for lesson completion
    await this.recordActivity(student.id, { xpEarned: 50 });

    return { success: true, xp: 50 };
  }

  // ─── Review (SM-2) ──────────────────────────────────

  async getReviewStats(studentId: string) {
    const today = new Date().toISOString().split("T")[0];

    const [dueCount, totalCount, masteredCount] = await Promise.all([
      this.reviewRepo.count({
        where: { studentId, isRetired: false, nextReviewDate: LessThanOrEqual(today) },
      }),
      this.reviewRepo.count({ where: { studentId, isRetired: false } }),
      this.reviewRepo.count({ where: { studentId, isRetired: true } }),
    ]);

    return { dueToday: dueCount, total: totalCount, mastered: masteredCount };
  }

  async getReviewQueue(studentId: string) {
    const today = new Date().toISOString().split("T")[0];

    const items = await this.reviewRepo.find({
      where: {
        studentId,
        isRetired: false,
        nextReviewDate: LessThanOrEqual(today),
      },
      order: { nextReviewDate: "ASC" },
      take: 15,
    });

    return items;
  }

  async submitReview(studentId: string, reviewId: string, dto: SubmitReviewDto) {
    const item = await this.reviewRepo.findOne({ where: { id: reviewId, studentId } });
    if (!item) throw new NotFoundException("Review item not found");

    // SM-2 algorithm
    const q = dto.quality;
    let { easeFactor, interval, repetitions } = item;

    if (q >= 3) {
      // Correct
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions += 1;
    } else {
      // Incorrect — reset
      repetitions = 0;
      interval = 1;
    }

    easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;

    // Next review date
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + interval);
    const nextReviewDate = nextDate.toISOString().split("T")[0];

    // Check retirement (6 consecutive correct, interval > 30 days)
    const isRetired = repetitions >= 6 && interval > 30;

    await this.reviewRepo.update(reviewId, {
      easeFactor,
      interval,
      repetitions,
      nextReviewDate,
      isRetired,
    });

    // XP: 5 per review item
    await this.recordActivity(studentId, { reviewItemsCompleted: 1, xpEarned: 5 });

    return { nextReviewDate, interval, isRetired, xp: 5 };
  }

  // ─── Classes ─────────────────────────────────────────

  async getClasses(student: Student, tab: "upcoming" | "past" = "upcoming") {
    const now = new Date();
    const query = this.classStudentRepo
      .createQueryBuilder("cs")
      .innerJoinAndSelect("cs.class_", "c")
      .leftJoinAndSelect("c.teacher", "t")
      .where("cs.studentId = :studentId", { studentId: student.id });

    if (tab === "upcoming") {
      query
        .andWhere("c.status IN (:...statuses)", { statuses: ["scheduled", "confirmed"] })
        .andWhere("c.scheduledAt > :now", { now })
        .orderBy("c.scheduledAt", "ASC");
    } else {
      query
        .andWhere("c.status = :status", { status: "completed" })
        .orderBy("c.scheduledAt", "DESC");
    }

    const enrollments = await query.take(50).getMany();

    return enrollments.map((cs) => ({
      id: cs.class_.id,
      title: cs.class_.title,
      status: cs.class_.status,
      scheduledAt: cs.class_.scheduledAt,
      durationMinutes: cs.class_.durationMinutes,
      type: cs.class_.classType,
      teacher: cs.class_.teacher
        ? { id: cs.class_.teacher.id, name: cs.class_.teacher.name }
        : null,
    }));
  }

  async getClassReport(student: Student, classId: string) {
    // ClassReport uses roomId, find the class first to get roomId
    const cls = await this.classRepo.findOne({ where: { id: classId } });
    if (!cls || !cls.roomId) throw new NotFoundException("Report not found");

    const report = await this.reportRepo.findOne({
      where: { roomId: cls.roomId },
    });
    if (!report) throw new NotFoundException("Report not found");

    // Extract student-specific report from studentReports JSONB
    const myReport = report.studentReports?.find(
      (r) => r.email === student.email || r.studentId === student.id,
    );

    return {
      classId,
      summary: report.summary,
      studentReport: myReport || null,
    };
  }

  // ─── Explore ─────────────────────────────────────────

  async exploreCourses(student: Student, language?: string, level?: string) {
    const query = this.courseRepo
      .createQueryBuilder("c")
      .where("c.academyId = :academyId", { academyId: student.academyId })
      .andWhere("c.status = :status", { status: CourseStatus.PUBLISHED });

    // Default to student's learning language if no explicit filter
    const langFilter = language || student.learningLanguage;
    if (langFilter) query.andWhere("LOWER(c.language) = LOWER(:language)", { language: langFilter });
    if (level) query.andWhere("UPPER(c.cefrLevel) = UPPER(:level)", { level });

    return query.orderBy("c.createdAt", "DESC").getMany();
  }

  // ─── Profile ─────────────────────────────────────────

  async updatePreferences(studentId: string, dto: UpdatePreferencesDto) {
    const updates: Record<string, unknown> = {};
    if (dto.nativeLanguage !== undefined) updates.nativeLanguage = dto.nativeLanguage;
    if (dto.learningLanguage !== undefined) updates.learningLanguage = dto.learningLanguage;
    if (dto.selfAssessedLevel !== undefined) updates.selfAssessedLevel = dto.selfAssessedLevel;
    if (dto.learningGoal !== undefined) updates.learningGoal = dto.learningGoal;
    if (dto.occupation !== undefined) updates.occupation = dto.occupation;
    if (dto.interests !== undefined) updates.interests = dto.interests;
    if (dto.dailyGoalMinutes !== undefined) updates.dailyGoalMinutes = dto.dailyGoalMinutes;

    if (Object.keys(updates).length > 0) {
      await this.studentRepo.update(studentId, updates);
    }
    return { success: true };
  }

  async getProfile(student: Student) {
    const [streak, totalXp] = await Promise.all([
      this.streakRepo.findOne({ where: { studentId: student.id } }),
      this.dailyRepo
        .createQueryBuilder("da")
        .select("COALESCE(SUM(da.xpEarned), 0)", "total")
        .where("da.studentId = :studentId", { studentId: student.id })
        .getRawOne(),
    ]);

    return {
      id: student.id,
      name: student.name,
      email: student.email,
      profileImageUrl: student.profileImageUrl,
      learningLanguage: student.learningLanguage,
      nativeLanguage: student.nativeLanguage,
      selfAssessedLevel: student.selfAssessedLevel,
      learningGoal: student.learningGoal,
      occupation: student.occupation,
      interests: student.interests,
      dailyGoalMinutes: student.dailyGoalMinutes,
      timezone: student.timezone,
      onboardingCompleted: student.onboardingCompleted,
      streak: streak || { currentStreak: 0, longestStreak: 0 },
      totalXp: parseInt(totalXp?.total || "0"),
    };
  }

  async updateProfile(studentId: string, dto: UpdateStudentProfileDto) {
    const updates: Record<string, unknown> = {};
    if (dto.name) updates.name = dto.name;
    if (dto.profileImageUrl !== undefined) updates.profileImageUrl = dto.profileImageUrl;
    if (dto.dailyGoalMinutes) updates.dailyGoalMinutes = dto.dailyGoalMinutes;
    if (dto.timezone) updates.timezone = dto.timezone;

    await this.studentRepo.update(studentId, updates);
    return { success: true };
  }

  async getProgress(student: Student) {
    // Activity heatmap (last 12 weeks)
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

    const activities = await this.dailyRepo.find({
      where: {
        studentId: student.id,
        activityDate: LessThanOrEqual(new Date().toISOString().split("T")[0]),
      },
      order: { activityDate: "ASC" },
    });

    return {
      heatmap: activities.map((a) => ({
        date: a.activityDate,
        xp: a.xpEarned,
        exercises: a.exercisesCompleted,
        minutes: a.minutesPracticed,
      })),
    };
  }

  // ─── Streak ──────────────────────────────────────────

  async getStreak(studentId: string) {
    const streak = await this.streakRepo.findOne({ where: { studentId } });
    return streak || { currentStreak: 0, longestStreak: 0, freezesAvailable: 1, totalActivityDays: 0 };
  }

  async useStreakFreeze(studentId: string) {
    const streak = await this.streakRepo.findOne({ where: { studentId } });
    if (!streak || streak.freezesAvailable <= 0) {
      throw new NotFoundException("No freezes available");
    }

    streak.freezesAvailable -= 1;
    await this.streakRepo.save(streak);

    return { freezesAvailable: streak.freezesAvailable };
  }

  // ─── Student Learning Path ─────────────────────────

  async getStudentLearningPath(student: Student) {
    // Query eligible courses: published + matching language + has ≥1 lesson
    const eligibleCourses = await this.courseRepo
      .createQueryBuilder("c")
      .innerJoin("course_lessons", "cl", "cl.courseId = c.id")
      .where("c.academyId = :academyId", { academyId: student.academyId })
      .andWhere("c.status = :status", { status: CourseStatus.PUBLISHED })
      .andWhere("LOWER(c.language) = LOWER(:lang)", { lang: student.learningLanguage })
      .groupBy("c.id")
      .getMany();

    let slp = await this.slpRepo.findOne({ where: { studentId: student.id } });

    if (!slp) {
      if (eligibleCourses.length === 0) {
        return { status: "not_ready" as const, courses: [] };
      }

      const sorted = this.sortByCefrThenDate(eligibleCourses);
      const now = new Date();

      slp = await this.dataSource.transaction(async (manager) => {
        const path = manager.create(StudentLearningPath, {
          studentId: student.id,
          academyId: student.academyId,
          language: student.learningLanguage || "",
          generatedAt: now,
        });
        await manager.save(path);

        const slpCourses = sorted.map((course, i) =>
          manager.create(StudentLearningPathCourse, {
            studentLearningPathId: path.id,
            courseId: course.id,
            sortOrder: i,
            addedAt: now,
          }),
        );
        await manager.save(slpCourses);

        return path;
      });
    } else {
      // Append new courses not already in the SLP
      const existingCourseIds = await this.slpCourseRepo
        .find({ where: { studentLearningPathId: slp.id }, select: ["courseId"] })
        .then((rows) => new Set(rows.map((r) => r.courseId)));

      const newCourses = eligibleCourses.filter((c) => !existingCourseIds.has(c.id));

      if (newCourses.length > 0) {
        const maxOrder = await this.slpCourseRepo
          .createQueryBuilder("sc")
          .select("MAX(sc.sortOrder)", "max")
          .where("sc.studentLearningPathId = :slpId", { slpId: slp.id })
          .getRawOne()
          .then((r) => (r?.max ?? -1) as number);

        const sorted = this.sortByCefrThenDate(newCourses);
        const now = new Date();
        const newEntries = sorted.map((course, i) =>
          this.slpCourseRepo.create({
            studentLearningPathId: slp!.id,
            courseId: course.id,
            sortOrder: maxOrder + 1 + i,
            addedAt: now,
          }),
        );
        await this.slpCourseRepo.save(newEntries);
        await this.slpRepo.update(slp.id, { lastAppendedAt: now });
      }
    }

    // Load SLP courses with course relation
    const slpCourses = await this.slpCourseRepo.find({
      where: { studentLearningPathId: slp.id },
      relations: ["course"],
      order: { sortOrder: "ASC" },
    });

    // Load progress for all courses
    const courseIds = slpCourses.map((sc) => sc.courseId);
    const progress = courseIds.length
      ? await this.courseProgressRepo
          .createQueryBuilder("cp")
          .where("cp.studentId = :studentId", { studentId: student.id })
          .andWhere("cp.courseId IN (:...courseIds)", { courseIds })
          .getMany()
      : [];
    const progressMap = new Map(progress.map((p) => [p.courseId, p]));

    // Count lessons per course
    const lessonCounts = courseIds.length
      ? await this.courseLessonRepo
          .createQueryBuilder("cl")
          .select("cl.courseId", "courseId")
          .addSelect("COUNT(*)", "count")
          .where("cl.courseId IN (:...courseIds)", { courseIds })
          .groupBy("cl.courseId")
          .getRawMany<{ courseId: string; count: string }>()
      : [];
    const lessonCountMap = new Map(lessonCounts.map((r) => [r.courseId, parseInt(r.count)]));

    const studentLevel = (student.selfAssessedLevel || "").toUpperCase();

    return {
      status: "ready" as const,
      id: slp.id,
      generatedAt: slp.generatedAt,
      courses: slpCourses.map((sc) => {
        const p = progressMap.get(sc.courseId);
        const courseLevel = (sc.course.cefrLevel || "").toUpperCase();
        const studentIdx = (CEFR_LEVELS as readonly string[]).indexOf(studentLevel);
        const courseIdx = (CEFR_LEVELS as readonly string[]).indexOf(courseLevel);
        const isLocked = courseIdx !== -1 && studentIdx !== -1 && courseIdx > studentIdx;

        return {
          id: sc.course.id,
          title: sc.course.title,
          description: sc.course.description,
          level: sc.course.cefrLevel,
          language: sc.course.language,
          thumbnailUrl: sc.course.thumbnailUrl ?? null,
          isLocked,
          sortOrder: sc.sortOrder,
          addedAt: sc.addedAt,
          status: p?.status || "not_started",
          completedLessons: p?.completedLessons || 0,
          totalLessons: lessonCountMap.get(sc.courseId) || p?.totalLessons || 0,
        };
      }),
    };
  }

  private sortByCefrThenDate(courses: Course[]): Course[] {
    return [...courses].sort((a, b) => {
      const aIdx = (CEFR_LEVELS as readonly string[]).indexOf((a.cefrLevel || "").toUpperCase());
      const bIdx = (CEFR_LEVELS as readonly string[]).indexOf((b.cefrLevel || "").toUpperCase());
      const aOrder = aIdx === -1 ? 999 : aIdx;
      const bOrder = bIdx === -1 ? 999 : bIdx;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
    });
  }

  // ─── Internal Helpers ────────────────────────────────

  private async recordActivity(
    studentId: string,
    data: {
      exercisesCompleted?: number;
      reviewItemsCompleted?: number;
      minutesPracticed?: number;
      classesAttended?: number;
      xpEarned?: number;
    },
  ) {
    const today = new Date().toISOString().split("T")[0];

    let activity = await this.dailyRepo.findOne({
      where: { studentId, activityDate: today },
    });

    if (!activity) {
      activity = this.dailyRepo.create({ studentId, activityDate: today });
    }

    if (data.exercisesCompleted) activity.exercisesCompleted += data.exercisesCompleted;
    if (data.reviewItemsCompleted) activity.reviewItemsCompleted += data.reviewItemsCompleted;
    if (data.minutesPracticed) activity.minutesPracticed += data.minutesPracticed;
    if (data.classesAttended) activity.classesAttended += data.classesAttended;
    if (data.xpEarned) activity.xpEarned += data.xpEarned;

    await this.dailyRepo.save(activity);

    // Update streak
    await this.updateStreak(studentId);
  }

  private async updateStreak(studentId: string) {
    const today = new Date().toISOString().split("T")[0];
    let streak = await this.streakRepo.findOne({ where: { studentId } });

    if (!streak) {
      streak = this.streakRepo.create({ studentId });
    }

    if (streak.lastActivityDate === today) return; // Already counted today

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoStr = twoDaysAgo.toISOString().split("T")[0];

    if (streak.lastActivityDate === yesterdayStr) {
      streak.currentStreak += 1;
    } else if (streak.lastActivityDate === twoDaysAgoStr && streak.freezesAvailable > 0) {
      // Auto-use freeze
      streak.freezesAvailable -= 1;
      streak.currentStreak += 1;
    } else if (streak.lastActivityDate && streak.lastActivityDate !== today) {
      streak.currentStreak = 1;
    } else {
      streak.currentStreak = 1;
    }

    streak.lastActivityDate = today;
    streak.totalActivityDays += 1;
    if (streak.currentStreak > streak.longestStreak) {
      streak.longestStreak = streak.currentStreak;
    }

    await this.streakRepo.save(streak);
  }

  // ─── Post-Class Integration ──────────────────────────

  async ingestClassReport(classId: string, studentReports: { email: string; studentId: string; vocabulary?: { word: string; context?: string }[]; grammarErrors?: { text: string; correction?: string; rule?: string }[] }[]) {
    const cls = await this.classRepo.findOne({ where: { id: classId } });
    if (!cls) return;

    for (const report of studentReports) {
      const studentEmail = report.email;
      if (!studentEmail) continue;

      const student = await this.studentRepo.findOne({
        where: { academyId: cls.academyId, email: studentEmail },
      });
      if (!student) continue;

      const today = new Date().toISOString().split("T")[0];

      // Extract vocabulary items
      const vocabulary = report.vocabulary;
      if (vocabulary?.length) {
        const items = vocabulary.map((v) =>
          this.reviewRepo.create({
            studentId: student.id,
            itemType: "vocabulary",
            content: v as Record<string, unknown>,
            sourceType: "class_report",
            sourceId: classId,
            nextReviewDate: today,
          }),
        );
        await this.reviewRepo.save(items);
      }

      // Extract grammar errors
      const grammarErrors = report.grammarErrors;
      if (grammarErrors?.length) {
        const items = grammarErrors.map((g) =>
          this.reviewRepo.create({
            studentId: student.id,
            itemType: "grammar",
            content: g as Record<string, unknown>,
            sourceType: "class_report",
            sourceId: classId,
            nextReviewDate: today,
          }),
        );
        await this.reviewRepo.save(items);
      }
    }
  }
}
