import { Injectable, NotFoundException, ConflictException, ForbiddenException, InternalServerErrorException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Course, CourseLesson, Lesson, LearningPathCourse, User } from "../database/entities/index.js";
import { CourseStatus, UserPlan, UsageMetric } from "@langopia/shared/types";
import { CreateCourseDto } from "./dto/create-course.dto.js";
import { UpdateCourseDto } from "./dto/update-course.dto.js";
import { QueryCoursesDto } from "./dto/query-courses.dto.js";
import { ManageCourseLessonsDto } from "./dto/manage-course-lessons.dto.js";
import { GenerateCourseDto } from "./dto/generate-course.dto.js";
import { RefineCourseDto } from "./dto/refine-course.dto.js";
import { UsageService } from "../usage/usage.service.js";

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
    @InjectRepository(CourseLesson)
    private readonly courseLessonRepo: Repository<CourseLesson>,
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
    @InjectRepository(LearningPathCourse)
    private readonly learningPathCourseRepo: Repository<LearningPathCourse>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly usage: UsageService,
  ) {}

  async list(academyId: string, query: QueryCoursesDto) {
    const limit = Math.min(query.limit ?? 50, 100);
    const offset = query.offset ?? 0;

    const qb = this.courseRepo
      .createQueryBuilder("course")
      .leftJoinAndSelect("course.courseLessons", "cl")
      .leftJoinAndSelect("cl.lesson", "lesson")
      .loadRelationCountAndMap("course.lessonCount", "course.courseLessons")
      .where("course.academyId = :academyId", { academyId })
      .orderBy("course.createdAt", "DESC")
      .take(limit)
      .skip(offset);

    if (query.language) {
      qb.andWhere("course.language = :language", { language: query.language });
    }
    if (query.cefrLevel) {
      qb.andWhere("course.cefrLevel = :cefrLevel", { cefrLevel: query.cefrLevel });
    }
    if (query.status) {
      qb.andWhere("course.status = :status", { status: query.status });
    }
    if (query.search) {
      qb.andWhere("course.title ILIKE :search", { search: `%${query.search}%` });
    }

    const [data, total] = await qb.getManyAndCount();

    return { data, total, limit, offset };
  }

  async create(academyId: string, dto: CreateCourseDto) {
    const course = this.courseRepo.create({
      academyId,
      title: dto.title,
      description: dto.description ?? null,
      language: dto.language,
      cefrLevel: dto.cefrLevel,
      thumbnailUrl: dto.thumbnailUrl ?? null,
      estimatedHours: dto.estimatedHours ?? null,
      status: CourseStatus.DRAFT,
    });

    return this.courseRepo.save(course);
  }

  async findOne(academyId: string, id: string) {
    const course = await this.courseRepo.findOne({
      where: { id, academyId },
      relations: ["courseLessons", "courseLessons.lesson"],
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    return course;
  }

  async update(academyId: string, id: string, dto: UpdateCourseDto) {
    const course = await this.courseRepo.findOne({
      where: { id, academyId },
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    this.courseRepo.merge(course, dto);
    return this.courseRepo.save(course);
  }

  async remove(academyId: string, id: string) {
    const course = await this.courseRepo.findOne({
      where: { id, academyId },
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    const lpLinkCount = await this.learningPathCourseRepo.count({
      where: { courseId: id },
    });
    if (lpLinkCount > 0) {
      throw new ConflictException(
        "Cannot delete course: it is linked to a learning path. Remove it from all learning paths first.",
      );
    }

    await this.courseRepo.remove(course);
  }

  async setLessons(academyId: string, courseId: string, dto: ManageCourseLessonsDto) {
    const course = await this.courseRepo.findOne({
      where: { id: courseId, academyId },
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    // Delete existing course lessons
    await this.courseLessonRepo.delete({ courseId });

    // Insert new ones
    const courseLessons = dto.lessons.map((item) =>
      this.courseLessonRepo.create({
        courseId,
        lessonId: item.lessonId,
        sortOrder: item.sortOrder,
        moduleTitle: item.moduleTitle ?? null,
        moduleOrder: item.moduleOrder ?? 0,
      }),
    );

    await this.courseLessonRepo.save(courseLessons);

    // Return updated course with lessons
    return this.findOne(academyId, courseId);
  }

  // POST /courses/generate — generate course plan with AI
  async generate(academyId: string, ownerId: string, dto: GenerateCourseDto) {
    const language = dto.language || "en";
    const cefrLevel = dto.cefrLevel || "B1";

    // Check AI token plan limit
    const user = await this.userRepo.findOne({ where: { id: ownerId } });
    const plan = (user?.plan as UserPlan) ?? UserPlan.FREE;
    const limitCheck = await this.usage.checkPlanLimit(
      ownerId,
      plan,
      UsageMetric.AI_TOKENS,
    );
    if (!limitCheck.allowed) {
      throw new ForbiddenException(
        "AI token limit exceeded. Please upgrade your plan.",
      );
    }

    // Fetch academy lessons (filtered)
    const qb = this.lessonRepo
      .createQueryBuilder("lesson")
      .leftJoin("lesson.lessonExercises", "le")
      .addSelect("COUNT(le.id)", "exerciseCount")
      .where("lesson.academyId = :academyId", { academyId })
      .groupBy("lesson.id")
      .limit(200);

    if (language) {
      qb.andWhere("lesson.language = :language", { language });
    }
    if (cefrLevel) {
      qb.andWhere("lesson.cefrLevel = :cefrLevel", { cefrLevel });
    }

    const rawLessons = await qb.getRawAndEntities();
    const existingLessons = rawLessons.entities.map((lesson, i) => ({
      id: lesson.id,
      title: lesson.title,
      description: (lesson as unknown as Record<string, unknown>).description as string | null,
      status: lesson.status,
      exerciseCount: parseInt(rawLessons.raw[i]?.exerciseCount ?? "0", 10),
    }));

    try {
      const { generateCoursePlan } = await import("@langopia/ai-pipeline");

      const result = await generateCoursePlan({
        prompt: dto.prompt,
        language,
        cefrLevel,
        existingLessons,
      });

      // Track AI token usage
      if (result.tokensUsed > 0) {
        await this.usage.incrementUsage(
          ownerId,
          academyId,
          UsageMetric.AI_TOKENS,
          result.tokensUsed,
        );
      }

      return result;
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      this.logger.error("Failed to generate course plan:", err);
      throw new InternalServerErrorException("Failed to generate course plan");
    }
  }

  // POST /courses/generate/refine — refine course plan via chat
  async refinePlan(academyId: string, ownerId: string, dto: RefineCourseDto) {
    const language = dto.language || "en";
    const cefrLevel = dto.cefrLevel || "B1";

    // Check AI token plan limit
    const user = await this.userRepo.findOne({ where: { id: ownerId } });
    const plan = (user?.plan as UserPlan) ?? UserPlan.FREE;
    const limitCheck = await this.usage.checkPlanLimit(
      ownerId,
      plan,
      UsageMetric.AI_TOKENS,
    );
    if (!limitCheck.allowed) {
      throw new ForbiddenException(
        "AI token limit exceeded. Please upgrade your plan.",
      );
    }

    // Fetch lessons for re-matching
    const qb = this.lessonRepo
      .createQueryBuilder("lesson")
      .leftJoin("lesson.lessonExercises", "le")
      .addSelect("COUNT(le.id)", "exerciseCount")
      .where("lesson.academyId = :academyId", { academyId })
      .groupBy("lesson.id")
      .limit(200);

    if (language) {
      qb.andWhere("lesson.language = :language", { language });
    }
    if (cefrLevel) {
      qb.andWhere("lesson.cefrLevel = :cefrLevel", { cefrLevel });
    }

    const rawLessons = await qb.getRawAndEntities();
    const existingLessons = rawLessons.entities.map((lesson, i) => ({
      id: lesson.id,
      title: lesson.title,
      description: (lesson as unknown as Record<string, unknown>).description as string | null,
      status: lesson.status,
      exerciseCount: parseInt(rawLessons.raw[i]?.exerciseCount ?? "0", 10),
    }));

    try {
      const { refineCoursePlan } = await import("@langopia/ai-pipeline");

      const result = await refineCoursePlan({
        currentPlan: dto.currentPlan,
        userMessage: dto.userMessage,
        language,
        cefrLevel,
        existingLessons,
      });

      // Track AI token usage
      if (result.tokensUsed > 0) {
        await this.usage.incrementUsage(
          ownerId,
          academyId,
          UsageMetric.AI_TOKENS,
          result.tokensUsed,
        );
      }

      return result;
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      this.logger.error("Failed to refine course plan:", err);
      throw new InternalServerErrorException("Failed to refine course plan");
    }
  }
}
