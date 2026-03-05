import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { AcademyMember } from "../database/entities/academy-member.entity.js";
import { Class } from "../database/entities/class.entity.js";
import { ClassStudent } from "../database/entities/class-student.entity.js";
import { ClassReport } from "../database/entities/class-report.entity.js";
import { Exercise } from "../database/entities/exercise.entity.js";
import { Lesson } from "../database/entities/lesson.entity.js";
import { LessonExercise } from "../database/entities/lesson-exercise.entity.js";
import { Notification } from "../database/entities/notification.entity.js";
import type { User } from "../database/entities/user.entity.js";
import { QueryMyClassesDto } from "./dto/query-my-classes.dto.js";
import { QueryMyReportsDto } from "./dto/query-my-reports.dto.js";
import { QueryMyExercisesDto } from "./dto/query-my-exercises.dto.js";
import { QueryMyLessonsDto } from "./dto/query-my-lessons.dto.js";

@Injectable()
export class MeService {
  private readonly appUrl: string;

  constructor(
    @InjectRepository(AcademyMember)
    private readonly memberRepo: Repository<AcademyMember>,
    @InjectRepository(Class)
    private readonly classRepo: Repository<Class>,
    @InjectRepository(ClassStudent)
    private readonly classStudentRepo: Repository<ClassStudent>,
    @InjectRepository(ClassReport)
    private readonly reportRepo: Repository<ClassReport>,
    @InjectRepository(Exercise)
    private readonly exerciseRepo: Repository<Exercise>,
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
    @InjectRepository(LessonExercise)
    private readonly lessonExerciseRepo: Repository<LessonExercise>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly config: ConfigService,
  ) {
    this.appUrl =
      this.config.get<string>("APP_URL") ??
      this.config.get<string>("NEXT_PUBLIC_APP_URL") ??
      "http://localhost:3000";
  }

  /** Get all AcademyMember IDs for a user */
  private async getMemberIds(userId: string): Promise<string[]> {
    const members = await this.memberRepo.find({
      where: { userId },
      select: ["id"],
    });
    return members.map((m) => m.id);
  }

  /** Get all academy IDs for a user */
  private async getAcademyIds(userId: string): Promise<string[]> {
    const members = await this.memberRepo.find({
      where: { userId },
      select: ["academyId"],
    });
    return [...new Set(members.map((m) => m.academyId))];
  }

  async getStats(user: User) {
    const memberIds = await this.getMemberIds(user.id);

    if (memberIds.length === 0) {
      return {
        upcomingClasses: 0,
        completedClasses: 0,
        totalReports: 0,
        nextClass: null,
      };
    }

    const now = new Date();

    const upcomingClasses = await this.classRepo
      .createQueryBuilder("cls")
      .where("cls.teacherId IN (:...memberIds)", { memberIds })
      .andWhere("cls.status IN (:...statuses)", {
        statuses: ["scheduled", "confirmed"],
      })
      .andWhere("cls.scheduledAt > :now", { now })
      .getCount();

    const completedClasses = await this.classRepo
      .createQueryBuilder("cls")
      .where("cls.teacherId IN (:...memberIds)", { memberIds })
      .andWhere("cls.status = :status", { status: "completed" })
      .getCount();

    const totalReports = await this.reportRepo
      .createQueryBuilder("report")
      .innerJoin("report.room", "room")
      .innerJoin(Class, "cls", "cls.roomId = room.id")
      .where("cls.teacherId IN (:...memberIds)", { memberIds })
      .getCount();

    const nextClassEntity = await this.classRepo
      .createQueryBuilder("cls")
      .where("cls.teacherId IN (:...memberIds)", { memberIds })
      .andWhere("cls.status IN (:...statuses)", {
        statuses: ["scheduled", "confirmed"],
      })
      .andWhere("cls.scheduledAt > :now", { now })
      .orderBy("cls.scheduledAt", "ASC")
      .getOne();

    return {
      upcomingClasses,
      completedClasses,
      totalReports,
      nextClass: nextClassEntity
        ? {
            id: nextClassEntity.id,
            title: nextClassEntity.title,
            scheduledAt: nextClassEntity.scheduledAt,
            durationMinutes: nextClassEntity.durationMinutes,
          }
        : null,
    };
  }

  async getClasses(user: User, query: QueryMyClassesDto) {
    const memberIds = await this.getMemberIds(user.id);
    const limit = Math.min(query.limit ?? 50, 100);
    const offset = query.offset ?? 0;

    if (memberIds.length === 0) {
      return { data: [], total: 0, limit, offset };
    }

    const qb = this.classRepo
      .createQueryBuilder("cls")
      .leftJoinAndSelect("cls.teacher", "teacher")
      .leftJoin("teacher.user", "teacherUser")
      .addSelect(["teacherUser.name", "teacherUser.email"])
      .leftJoinAndSelect("cls.academy", "academy")
      .where("cls.teacherId IN (:...memberIds)", { memberIds })
      .orderBy("cls.scheduledAt", "DESC")
      .take(limit)
      .skip(offset);

    if (query.status) {
      qb.andWhere("cls.status = :status", { status: query.status });
    }
    if (query.from) {
      qb.andWhere("cls.scheduledAt >= :from", { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere("cls.scheduledAt <= :to", { to: new Date(query.to) });
    }
    if (query.classType) {
      qb.andWhere("cls.classType = :classType", {
        classType: query.classType,
      });
    }

    const [classes, total] = await qb.getManyAndCount();

    return {
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
        academyName: (c as Class & { academy: { name: string } }).academy
          ?.name,
        teacher: c.teacher
          ? {
              id: c.teacher.id,
              name: (c.teacher as AcademyMember & { user: { name: string } })
                .user?.name,
            }
          : null,
        roomId: c.roomId,
      })),
      total,
      limit,
      offset,
    };
  }

  async getClassDetail(user: User, classId: string) {
    const memberIds = await this.getMemberIds(user.id);

    if (memberIds.length === 0) {
      throw new NotFoundException("Class not found");
    }

    const cls = await this.classRepo
      .createQueryBuilder("cls")
      .leftJoinAndSelect("cls.teacher", "teacher")
      .leftJoin("teacher.user", "teacherUser")
      .addSelect(["teacherUser.name", "teacherUser.email"])
      .leftJoinAndSelect("cls.lesson", "lesson")
      .leftJoinAndSelect("cls.room", "room")
      .leftJoinAndSelect("cls.academy", "academy")
      .where("cls.id = :classId", { classId })
      .andWhere("cls.teacherId IN (:...memberIds)", { memberIds })
      .getOne();

    if (!cls) {
      throw new NotFoundException("Class not found");
    }

    const classStudents = await this.classStudentRepo.find({
      where: { classId: cls.id },
      relations: ["student"],
    });

    return {
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
      academyName: (cls as Class & { academy: { name: string } }).academy
        ?.name,
      teacher: cls.teacher
        ? {
            id: cls.teacher.id,
            name: (
              cls.teacher as AcademyMember & {
                user: { name: string; email: string };
              }
            ).user?.name,
            email: (
              cls.teacher as AcademyMember & {
                user: { name: string; email: string };
              }
            ).user?.email,
          }
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
      room: cls.room ? { id: cls.room.id, status: cls.room.status } : null,
      teacherUrl: `${this.appUrl}/class/${cls.id}?token=${cls.teacherToken}`,
      studentUrl: `${this.appUrl}/class/${cls.id}?token=${cls.studentToken}`,
      createdAt: cls.createdAt,
      updatedAt: cls.updatedAt,
    };
  }

  async getReports(user: User, query: QueryMyReportsDto) {
    const memberIds = await this.getMemberIds(user.id);
    const limit = Math.min(query.limit ?? 50, 100);
    const offset = query.offset ?? 0;

    if (memberIds.length === 0) {
      return { data: [], total: 0, limit, offset };
    }

    const qb = this.reportRepo
      .createQueryBuilder("report")
      .innerJoinAndSelect("report.room", "room")
      .innerJoin(Class, "cls", "cls.roomId = room.id")
      .addSelect(["cls.id", "cls.title", "cls.scheduledAt"])
      .where("cls.teacherId IN (:...memberIds)", { memberIds })
      .orderBy("report.createdAt", "DESC")
      .take(limit)
      .skip(offset);

    if (query.status) {
      qb.andWhere("report.status = :status", { status: query.status });
    }

    const [reports, total] = await qb.getManyAndCount();

    // Load class info for each report (since cls was used as a filter join)
    const roomIds = reports.map((r) => r.roomId);
    const classMap = new Map<string, { id: string; title: string; scheduledAt: Date }>();
    if (roomIds.length > 0) {
      const classes = await this.classRepo
        .createQueryBuilder("cls")
        .select(["cls.id", "cls.title", "cls.scheduledAt", "cls.roomId"])
        .where("cls.roomId IN (:...roomIds)", { roomIds })
        .getMany();
      for (const c of classes) {
        classMap.set(c.roomId!, {
          id: c.id,
          title: c.title,
          scheduledAt: c.scheduledAt,
        });
      }
    }

    return {
      data: reports.map((r) => ({
        id: r.id,
        status: r.status,
        summary: r.summary,
        classDuration: r.classDuration,
        studentCount: r.studentReports?.length ?? 0,
        class: classMap.get(r.roomId) ?? null,
        createdAt: r.createdAt,
      })),
      total,
      limit,
      offset,
    };
  }

  async getReportDetail(user: User, reportId: string) {
    const memberIds = await this.getMemberIds(user.id);

    if (memberIds.length === 0) {
      throw new NotFoundException("Report not found");
    }

    const report = await this.reportRepo
      .createQueryBuilder("report")
      .innerJoinAndSelect("report.room", "room")
      .where("report.id = :reportId", { reportId })
      .getOne();

    if (!report) {
      throw new NotFoundException("Report not found");
    }

    // Verify access: the class for this room must belong to this teacher
    const cls = await this.classRepo
      .createQueryBuilder("cls")
      .leftJoinAndSelect("cls.academy", "academy")
      .where("cls.roomId = :roomId", { roomId: report.roomId })
      .andWhere("cls.teacherId IN (:...memberIds)", { memberIds })
      .getOne();

    if (!cls) {
      throw new NotFoundException("Report not found");
    }

    return {
      id: report.id,
      status: report.status,
      summary: report.summary,
      classDuration: report.classDuration,
      tokensUsed: report.tokensUsed,
      teacher: report.teacher,
      studentReports: report.studentReports,
      class: {
        id: cls.id,
        title: cls.title,
        scheduledAt: cls.scheduledAt,
        language: cls.language,
      },
      academyName: (cls as Class & { academy: { name: string } }).academy
        ?.name,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    };
  }

  async getAcademies(user: User) {
    const members = await this.memberRepo.find({
      where: { userId: user.id },
      relations: ["academy"],
    });

    return members.map((m) => ({
      memberId: m.id,
      roles: m.roles,
      academy: {
        id: m.academy.id,
        name: m.academy.name,
        slug: m.academy.slug,
        academyType: m.academy.academyType,
      },
      joinedAt: m.joinedAt,
    }));
  }

  async getExercises(user: User, query: QueryMyExercisesDto) {
    const academyIds = await this.getAcademyIds(user.id);
    const limit = Math.min(query.limit ?? 50, 100);
    const offset = query.offset ?? 0;

    if (academyIds.length === 0) {
      return { data: [], total: 0, limit, offset };
    }

    const qb = this.exerciseRepo
      .createQueryBuilder("ex")
      .where("ex.academyId IN (:...academyIds)", { academyIds })
      .orderBy("ex.createdAt", "DESC")
      .take(limit)
      .skip(offset);

    if (query.language) {
      qb.andWhere("ex.language = :language", { language: query.language });
    }
    if (query.cefrLevel) {
      qb.andWhere("ex.cefrLevel = :cefrLevel", { cefrLevel: query.cefrLevel });
    }
    if (query.type) {
      qb.andWhere("ex.type = :type", { type: query.type });
    }
    if (query.targetSkill) {
      qb.andWhere("ex.targetSkill = :targetSkill", {
        targetSkill: query.targetSkill,
      });
    }

    const [exercises, total] = await qb.getManyAndCount();

    return {
      data: exercises.map((ex) => ({
        id: ex.id,
        type: ex.type,
        source: ex.source,
        title: ex.title,
        instruction: ex.instruction,
        content: ex.content,
        options: ex.options,
        correctAnswer: ex.correctAnswer,
        explanation: ex.explanation,
        cefrLevel: ex.cefrLevel,
        targetSkill: ex.targetSkill,
        topic: ex.topic,
        language: ex.language,
        videoUrl: ex.videoUrl,
        imageUrl: ex.imageUrl,
        audioUrl: ex.audioUrl,
        academyId: ex.academyId,
        createdAt: ex.createdAt,
        updatedAt: ex.updatedAt,
      })),
      total,
      limit,
      offset,
    };
  }

  async getExerciseDetail(user: User, exerciseId: string) {
    const academyIds = await this.getAcademyIds(user.id);

    if (academyIds.length === 0) {
      throw new NotFoundException("Exercise not found");
    }

    const exercise = await this.exerciseRepo
      .createQueryBuilder("ex")
      .where("ex.id = :exerciseId", { exerciseId })
      .andWhere("ex.academyId IN (:...academyIds)", { academyIds })
      .getOne();

    if (!exercise) {
      throw new NotFoundException("Exercise not found");
    }

    return {
      id: exercise.id,
      type: exercise.type,
      source: exercise.source,
      title: exercise.title,
      instruction: exercise.instruction,
      content: exercise.content,
      options: exercise.options,
      correctAnswer: exercise.correctAnswer,
      explanation: exercise.explanation,
      cefrLevel: exercise.cefrLevel,
      targetSkill: exercise.targetSkill,
      topic: exercise.topic,
      language: exercise.language,
      videoUrl: exercise.videoUrl,
      imageUrl: exercise.imageUrl,
      audioUrl: exercise.audioUrl,
      academyId: exercise.academyId,
      createdAt: exercise.createdAt,
      updatedAt: exercise.updatedAt,
    };
  }

  async getLessons(user: User, query: QueryMyLessonsDto) {
    const academyIds = await this.getAcademyIds(user.id);
    const limit = Math.min(query.limit ?? 50, 100);
    const offset = query.offset ?? 0;

    if (academyIds.length === 0) {
      return { data: [], total: 0, limit, offset };
    }

    const qb = this.lessonRepo
      .createQueryBuilder("lesson")
      .addSelect((sub) =>
        sub
          .select("COUNT(*)")
          .from(LessonExercise, "le")
          .where("le.lessonId = lesson.id"),
        "exerciseCount",
      )
      .where("lesson.academyId IN (:...academyIds)", { academyIds })
      .orderBy("lesson.createdAt", "DESC")
      .take(limit)
      .skip(offset);

    if (query.language) {
      qb.andWhere("lesson.language = :language", { language: query.language });
    }
    if (query.cefrLevel) {
      qb.andWhere("lesson.cefrLevel = :cefrLevel", {
        cefrLevel: query.cefrLevel,
      });
    }
    if (query.status) {
      qb.andWhere("lesson.status = :status", { status: query.status });
    }

    const { raw, entities } = await qb.getRawAndEntities();
    const total = await qb.getCount();

    return {
      data: entities.map((lesson, i) => ({
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        language: lesson.language,
        cefrLevel: lesson.cefrLevel,
        status: lesson.status,
        exerciseCount: parseInt(raw[i]?.exerciseCount ?? "0", 10),
        academyId: lesson.academyId,
        createdAt: lesson.createdAt,
        updatedAt: lesson.updatedAt,
      })),
      total,
      limit,
      offset,
    };
  }

  async getLessonDetail(user: User, lessonId: string) {
    const academyIds = await this.getAcademyIds(user.id);

    if (academyIds.length === 0) {
      throw new NotFoundException("Lesson not found");
    }

    const lesson = await this.lessonRepo
      .createQueryBuilder("lesson")
      .where("lesson.id = :lessonId", { lessonId })
      .andWhere("lesson.academyId IN (:...academyIds)", { academyIds })
      .getOne();

    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    const lessonExercises = await this.lessonExerciseRepo.find({
      where: { lessonId: lesson.id },
      relations: ["exercise"],
      order: { sortOrder: "ASC" },
    });

    return {
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      language: lesson.language,
      cefrLevel: lesson.cefrLevel,
      status: lesson.status,
      exercises: lessonExercises.map((le) => ({
        id: le.exercise.id,
        type: le.exercise.type,
        source: le.exercise.source,
        title: le.exercise.title,
        instruction: le.exercise.instruction,
        content: le.exercise.content,
        options: le.exercise.options,
        correctAnswer: le.exercise.correctAnswer,
        explanation: le.exercise.explanation,
        cefrLevel: le.exercise.cefrLevel,
        targetSkill: le.exercise.targetSkill,
        topic: le.exercise.topic,
        language: le.exercise.language,
        videoUrl: le.exercise.videoUrl,
        imageUrl: le.exercise.imageUrl,
        audioUrl: le.exercise.audioUrl,
        academyId: le.exercise.academyId,
        createdAt: le.exercise.createdAt,
        updatedAt: le.exercise.updatedAt,
        sortOrder: le.sortOrder,
      })),
      academyId: lesson.academyId,
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
    };
  }

  async getNotifications(user: User, query: { limit?: number; offset?: number }) {
    const limit = Math.min(query.limit ?? 50, 100);
    const offset = query.offset ?? 0;

    const [notifications, total] = await this.notificationRepo.findAndCount({
      where: { userId: user.id },
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset,
    });

    const unreadCount = await this.notificationRepo.count({
      where: { userId: user.id, read: false },
    });

    return {
      data: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data,
        read: n.read,
        createdAt: n.createdAt,
      })),
      unreadCount,
      total,
      limit,
      offset,
    };
  }

  async markNotificationRead(user: User, notificationId: string) {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId, userId: user.id },
    });

    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    notification.read = true;
    await this.notificationRepo.save(notification);

    return { success: true };
  }

  async markAllNotificationsRead(user: User) {
    await this.notificationRepo.update(
      { userId: user.id, read: false },
      { read: true },
    );

    return { success: true };
  }
}
