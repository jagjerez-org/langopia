import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Course, CourseLesson, Lesson } from "../database/entities/index.js";
import { CourseStatus } from "@langopia/shared/types";
import { CreateCourseDto } from "./dto/create-course.dto.js";
import { UpdateCourseDto } from "./dto/update-course.dto.js";
import { QueryCoursesDto } from "./dto/query-courses.dto.js";
import { ManageCourseLessonsDto } from "./dto/manage-course-lessons.dto.js";

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
    @InjectRepository(CourseLesson)
    private readonly courseLessonRepo: Repository<CourseLesson>,
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
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
      }),
    );

    await this.courseLessonRepo.save(courseLessons);

    // Return updated course with lessons
    return this.findOne(academyId, courseId);
  }
}
