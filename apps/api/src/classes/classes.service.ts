import * as crypto from "crypto";
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { UsageMetric } from "@langopia/shared/types";
import { Class } from "../database/entities/class.entity.js";
import { ClassStudent } from "../database/entities/class-student.entity.js";
import { AcademyMember } from "../database/entities/academy-member.entity.js";
import { Student } from "../database/entities/student.entity.js";
import { Lesson } from "../database/entities/lesson.entity.js";
import { User } from "../database/entities/user.entity.js";
import { Academy } from "../database/entities/academy.entity.js";
import { UsageService } from "../usage/usage.service.js";
import { EmailService } from "../email/email.service.js";
import { PushNotificationService } from "../push-notification/push-notification.service.js";
import { CreateClassDto } from "./dto/create-class.dto.js";
import { UpdateClassDto } from "./dto/update-class.dto.js";
import { QueryClassesDto } from "./dto/query-classes.dto.js";

@Injectable()
export class ClassesService {
  private readonly appUrl: string;

  constructor(
    @InjectRepository(Class)
    private readonly classRepo: Repository<Class>,
    @InjectRepository(ClassStudent)
    private readonly classStudentRepo: Repository<ClassStudent>,
    @InjectRepository(AcademyMember)
    private readonly memberRepo: Repository<AcademyMember>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly usageService: UsageService,
    private readonly emailService: EmailService,
    private readonly pushService: PushNotificationService,
    private readonly config: ConfigService,
  ) {
    this.appUrl =
      this.config.get<string>("APP_URL") ??
      this.config.get<string>("NEXT_PUBLIC_APP_URL") ??
      "http://localhost:3000";
  }

  async create(academy: Academy, ownerId: string, dto: CreateClassDto) {
    // Check plan limits
    const owner = await this.userRepo.findOne({ where: { id: ownerId } });
    if (!owner) {
      throw new InternalServerErrorException("Owner not found");
    }

    const limitCheck = await this.usageService.checkPlanLimit(
      ownerId,
      owner.plan,
      UsageMetric.ROOMS_CREATED,
    );
    if (!limitCheck.allowed) {
      throw new ForbiddenException(
        `Class limit reached (${limitCheck.current}/${limitCheck.limit}). Upgrade your plan.`,
      );
    }

    // Validate lessonId if provided
    if (dto.lessonId) {
      const lesson = await this.lessonRepo.findOne({
        where: { id: dto.lessonId, academyId: academy.id },
      });
      if (!lesson) {
        throw new BadRequestException(
          "Lesson not found or belongs to a different academy",
        );
      }
    }

    // Resolve teacherId
    let resolvedTeacherId: string | null = dto.teacherId ?? null;

    if (dto.teacherId) {
      // Validate teacherId is an AcademyMember with teacher role
      const teacherMember = await this.memberRepo
        .createQueryBuilder("m")
        .where("m.id = :id", { id: dto.teacherId })
        .andWhere("m.academyId = :academyId", { academyId: academy.id })
        .andWhere("m.roles @> :roles", { roles: JSON.stringify(["teacher"]) })
        .getOne();
      if (!teacherMember) {
        throw new BadRequestException(
          "Teacher not found or not a teacher in this academy",
        );
      }
    } else if (academy.academyType === "freelance") {
      // Freelance: auto-assign owner as teacher
      const ownerMember = await this.memberRepo
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

    // Create class (no Room yet -- created on-demand when teacher joins)
    const cls = new Class();
    cls.academyId = academy.id;
    cls.createdByUserId = ownerId;
    cls.title = dto.title;
    cls.description = dto.description ?? null;
    cls.classType = dto.classType ?? "individual";
    cls.maxStudents = dto.maxStudents ?? 1;
    cls.language = dto.language ?? "en";
    cls.lessonId = dto.lessonId ?? null;
    cls.teacherId = resolvedTeacherId;
    cls.status = "scheduled";
    cls.scheduledAt = new Date(dto.scheduledAt);
    cls.durationMinutes = dto.durationMinutes ?? 60;
    cls.cancellationMinutes = dto.cancellationMinutes ?? 60;
    cls.teacherToken = teacherToken;
    cls.studentToken = studentToken;

    const saved = await this.classRepo.save(cls);

    // Find/create Students from studentEmails and create ClassStudent entries
    const students: { id: string; email: string; name: string }[] = [];
    if (Array.isArray(dto.studentEmails) && dto.studentEmails.length > 0) {
      for (const email of dto.studentEmails) {
        if (typeof email !== "string" || !email.includes("@")) continue;
        let student = await this.studentRepo.findOne({
          where: { academyId: academy.id, email },
        });
        if (!student) {
          student = new Student();
          student.academyId = academy.id;
          student.email = email;
          student.name = email.split("@")[0];
          student = await this.studentRepo.save(student);
        }

        const cs = new ClassStudent();
        cs.classId = saved.id;
        cs.studentId = student.id;
        cs.status = "enrolled";
        await this.classStudentRepo.save(cs);

        students.push({
          id: student.id,
          email: student.email,
          name: student.name,
        });
      }
    }

    // Track usage
    await this.usageService.incrementUsage(
      ownerId,
      academy.id,
      UsageMetric.ROOMS_CREATED,
    );

    // Load teacher info for response
    let teacherInfo: { id: string; name: string; email: string } | null = null;
    let teacherUserId: string | null = null;
    if (resolvedTeacherId) {
      const tm = await this.memberRepo.findOne({
        where: { id: resolvedTeacherId },
        relations: ["user"],
      });
      if (tm) {
        teacherInfo = { id: tm.id, name: tm.user.name, email: tm.user.email };
        teacherUserId = tm.user.id;
      }
    }

    // Fire-and-forget: send email notifications
    const teacherUrl = `${this.appUrl}/class/${saved.id}?token=${teacherToken}`;
    const studentUrl = `${this.appUrl}/class/${saved.id}?token=${studentToken}`;

    if (teacherInfo?.email) {
      this.emailService
        .sendClassScheduled({
          to: teacherInfo.email,
          classTitle: saved.title,
          scheduledAt: saved.scheduledAt,
          durationMinutes: saved.durationMinutes,
          joinUrl: teacherUrl,
        })
        .catch(() => {});
    }
    for (const s of students) {
      this.emailService
        .sendClassScheduled({
          to: s.email,
          classTitle: saved.title,
          scheduledAt: saved.scheduledAt,
          durationMinutes: saved.durationMinutes,
          teacherName: teacherInfo?.name,
          joinUrl: studentUrl,
        })
        .catch(() => {});
    }

    // Fire-and-forget: push notification to teacher
    if (teacherUserId) {
      this.pushService
        .sendClassScheduled(teacherUserId, {
          classId: saved.id,
          classTitle: saved.title,
          scheduledAt: saved.scheduledAt.toISOString(),
          durationMinutes: saved.durationMinutes,
        })
        .catch(() => {});
    }

    return {
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
    };
  }

  async findAll(academy: Academy, query: QueryClassesDto) {
    const limit = Math.min(query.limit ?? 50, 100);
    const offset = query.offset ?? 0;

    const qb = this.classRepo
      .createQueryBuilder("cls")
      .leftJoinAndSelect("cls.teacher", "teacher")
      .leftJoin("teacher.user", "teacherUser")
      .addSelect(["teacherUser.name", "teacherUser.email"])
      .where("cls.academyId = :academyId", { academyId: academy.id })
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
    if (query.teacherId) {
      qb.andWhere("cls.teacherId = :teacherId", {
        teacherId: query.teacherId,
      });
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
        teacher: c.teacher
          ? {
              id: c.teacher.id,
              name: (c.teacher as AcademyMember & { user: User }).user?.name,
              email: (c.teacher as AcademyMember & { user: User }).user?.email,
            }
          : null,
        teacherUrl: `${this.appUrl}/class/${c.id}?token=${c.teacherToken}`,
        studentUrl: `${this.appUrl}/class/${c.id}?token=${c.studentToken}`,
        roomId: c.roomId,
        lessonId: c.lessonId,
        createdAt: c.createdAt,
      })),
      total,
      limit,
      offset,
    };
  }

  async findOne(academy: Academy, id: string) {
    const cls = await this.classRepo.findOne({
      where: { id, academyId: academy.id },
      relations: ["teacher", "teacher.user", "lesson", "room"],
    });

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
      teacher: cls.teacher
        ? {
            id: cls.teacher.id,
            name: (cls.teacher as AcademyMember & { user: User }).user?.name,
            email: (cls.teacher as AcademyMember & { user: User }).user?.email,
          }
        : null,
      students: classStudents.map((cs) => ({
        id: cs.student.id,
        email: cs.student.email,
        name: cs.student.name,
        status: cs.status,
      })),
      lesson: cls.lesson ? { id: cls.lesson.id, title: cls.lesson.title } : null,
      room: cls.room ? { id: cls.room.id, status: cls.room.status } : null,
      teacherUrl: `${this.appUrl}/class/${cls.id}?token=${cls.teacherToken}`,
      studentUrl: `${this.appUrl}/class/${cls.id}?token=${cls.studentToken}`,
      createdAt: cls.createdAt,
      updatedAt: cls.updatedAt,
    };
  }

  async update(academy: Academy, id: string, dto: UpdateClassDto) {
    const cls = await this.classRepo.findOne({
      where: { id, academyId: academy.id },
    });

    if (!cls) {
      throw new NotFoundException("Class not found");
    }

    if (cls.status !== "scheduled" && cls.status !== "confirmed") {
      throw new BadRequestException(
        "Can only update classes with status scheduled or confirmed",
      );
    }

    if (dto.title !== undefined) cls.title = dto.title;
    if (dto.description !== undefined) cls.description = dto.description ?? null;
    if (dto.scheduledAt !== undefined)
      cls.scheduledAt = new Date(dto.scheduledAt);
    if (dto.durationMinutes !== undefined)
      cls.durationMinutes = dto.durationMinutes;
    if (dto.maxStudents !== undefined) cls.maxStudents = dto.maxStudents;

    if (dto.lessonId !== undefined) {
      if (dto.lessonId) {
        const lesson = await this.lessonRepo.findOne({
          where: { id: dto.lessonId, academyId: academy.id },
        });
        if (!lesson) {
          throw new BadRequestException("Lesson not found");
        }
      }
      cls.lessonId = dto.lessonId ?? null;
    }

    if (dto.teacherId !== undefined) {
      if (dto.teacherId) {
        const teacherMember = await this.memberRepo
          .createQueryBuilder("m")
          .where("m.id = :id", { id: dto.teacherId })
          .andWhere("m.academyId = :academyId", { academyId: academy.id })
          .andWhere("m.roles @> :roles", {
            roles: JSON.stringify(["teacher"]),
          })
          .getOne();
        if (!teacherMember) {
          throw new BadRequestException("Teacher not found");
        }
      }
      cls.teacherId = dto.teacherId ?? null;
    }

    const saved = await this.classRepo.save(cls);

    return {
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
    };
  }

  async remove(academy: Academy, id: string) {
    const cls = await this.classRepo.findOne({
      where: { id, academyId: academy.id },
    });

    if (!cls) {
      throw new NotFoundException("Class not found");
    }

    if (cls.status !== "scheduled" && cls.status !== "confirmed") {
      throw new BadRequestException(
        "Can only delete classes with status scheduled or confirmed",
      );
    }

    // ClassStudents are CASCADE deleted
    await this.classRepo.remove(cls);

    return { success: true };
  }

  async cancel(academy: Academy, id: string, reason?: string) {
    const cls = await this.classRepo.findOne({
      where: { id, academyId: academy.id },
    });

    if (!cls) {
      throw new NotFoundException("Class not found");
    }

    if (cls.status !== "scheduled" && cls.status !== "confirmed") {
      throw new BadRequestException(
        "Can only cancel classes with status scheduled or confirmed",
      );
    }

    // Check cancellation policy
    const now = Date.now();
    const classTime = new Date(cls.scheduledAt).getTime();
    const cancellationDeadline =
      classTime - cls.cancellationMinutes * 60_000;

    if (now > cancellationDeadline) {
      throw new BadRequestException(
        `Cancellation deadline passed. Must cancel at least ${cls.cancellationMinutes} minutes before class.`,
      );
    }

    cls.status = "cancelled";
    cls.cancelledAt = new Date();
    cls.cancelReason = reason ?? null;
    await this.classRepo.save(cls);

    // Update all enrolled ClassStudent statuses
    await this.classStudentRepo
      .createQueryBuilder()
      .update()
      .set({ status: "cancelled" })
      .where("classId = :classId", { classId: cls.id })
      .andWhere("status = :status", { status: "enrolled" })
      .execute();

    // Fire-and-forget: send cancellation emails
    const emailRecipients: string[] = [];

    // Get teacher info
    let teacherUserId: string | null = null;
    if (cls.teacherId) {
      const teacherMember = await this.memberRepo.findOne({
        where: { id: cls.teacherId },
        relations: ["user"],
      });
      if (teacherMember?.user?.email) {
        emailRecipients.push(teacherMember.user.email);
        teacherUserId = teacherMember.user.id;
      }
    }

    // Get student emails
    const classStudents = await this.classStudentRepo.find({
      where: { classId: cls.id },
      relations: ["student"],
    });
    for (const cs of classStudents) {
      if (cs.student?.email) {
        emailRecipients.push(cs.student.email);
      }
    }

    for (const email of emailRecipients) {
      this.emailService
        .sendClassCancelled({
          to: email,
          classTitle: cls.title,
          scheduledAt: cls.scheduledAt,
          reason,
        })
        .catch(() => {});
    }

    // Fire-and-forget: push notification to teacher
    if (teacherUserId) {
      this.pushService
        .sendClassCancelled(teacherUserId, {
          classId: cls.id,
          classTitle: cls.title,
          reason,
        })
        .catch(() => {});
    }

    return {
      id: cls.id,
      status: cls.status,
      cancelledAt: cls.cancelledAt,
      cancelReason: cls.cancelReason,
    };
  }
}
