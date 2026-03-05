import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { LearningPath } from "../database/entities/learning-path.entity.js";
import { LearningPathLesson } from "../database/entities/learning-path-lesson.entity.js";
import { Lesson } from "../database/entities/lesson.entity.js";
import { LearningPathStatus } from "@langopia/shared/types";

@Injectable()
export class LearningPathsService {
  constructor(
    @InjectRepository(LearningPath)
    private readonly lpRepo: Repository<LearningPath>,
    @InjectRepository(LearningPathLesson)
    private readonly lplRepo: Repository<LearningPathLesson>,
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
  ) {}

  async listLearningPaths(
    academyId: string,
    opts: {
      language?: string;
      cefrLevel?: string;
      status?: LearningPathStatus;
      limit: number;
      offset: number;
    },
  ) {
    const { language, cefrLevel, status, limit, offset } = opts;

    const qb = this.lpRepo
      .createQueryBuilder("lp")
      .loadRelationCountAndMap("lp.lessonCount", "lp.learningPathLessons")
      .where("lp.academyId = :academyId", { academyId })
      .orderBy("lp.createdAt", "DESC")
      .take(limit)
      .skip(offset);

    if (language) qb.andWhere("lp.language = :language", { language });
    if (cefrLevel) qb.andWhere("lp.cefrLevel = :cefrLevel", { cefrLevel });
    if (status) qb.andWhere("lp.status = :status", { status });

    const [paths, total] = await qb.getManyAndCount();

    return {
      data: paths.map((lp: LearningPath & { lessonCount?: number }) => ({
        id: lp.id,
        title: lp.title,
        description: lp.description,
        language: lp.language,
        cefrLevel: lp.cefrLevel,
        status: lp.status,
        thumbnailUrl: lp.thumbnailUrl,
        estimatedHours: lp.estimatedHours,
        lessonCount: lp.lessonCount ?? 0,
        createdAt: lp.createdAt,
        updatedAt: lp.updatedAt,
      })),
      total,
      limit,
      offset,
    };
  }

  async createLearningPath(
    academyId: string,
    data: {
      title: string;
      cefrLevel: string;
      language?: string;
      description?: string;
      thumbnailUrl?: string;
      estimatedHours?: number;
    },
  ) {
    const lp = new LearningPath();
    lp.academyId = academyId;
    lp.title = data.title;
    lp.language = data.language || "en";
    lp.cefrLevel = data.cefrLevel;
    lp.description = data.description ?? null;
    lp.thumbnailUrl = data.thumbnailUrl ?? null;
    lp.estimatedHours = data.estimatedHours ?? null;
    lp.status = LearningPathStatus.DRAFT;

    const saved = await this.lpRepo.save(lp);

    return {
      id: saved.id,
      title: saved.title,
      description: saved.description,
      language: saved.language,
      cefrLevel: saved.cefrLevel,
      status: saved.status,
      thumbnailUrl: saved.thumbnailUrl,
      estimatedHours: saved.estimatedHours,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  async getLearningPathDetail(academyId: string, id: string) {
    const lp = await this.lpRepo.findOne({
      where: { id, academyId },
    });

    if (!lp) {
      throw new NotFoundException("Learning path not found");
    }

    // Fetch lessons with exercise counts
    const links = await this.lplRepo
      .createQueryBuilder("lpl")
      .leftJoinAndSelect("lpl.lesson", "lesson")
      .loadRelationCountAndMap("lesson.exerciseCount", "lesson.lessonExercises")
      .where("lpl.learningPathId = :lpId", { lpId: id })
      .orderBy("lpl.sortOrder", "ASC")
      .getMany();

    return {
      id: lp.id,
      title: lp.title,
      description: lp.description,
      language: lp.language,
      cefrLevel: lp.cefrLevel,
      status: lp.status,
      thumbnailUrl: lp.thumbnailUrl,
      estimatedHours: lp.estimatedHours,
      createdAt: lp.createdAt,
      updatedAt: lp.updatedAt,
      lessons: links.map((lpl) => ({
        id: lpl.lesson.id,
        title: lpl.lesson.title,
        description: lpl.lesson.description,
        language: lpl.lesson.language,
        cefrLevel: lpl.lesson.cefrLevel,
        status: lpl.lesson.status,
        exerciseCount:
          (lpl.lesson as unknown as { exerciseCount?: number }).exerciseCount ??
          0,
        sortOrder: lpl.sortOrder,
      })),
    };
  }

  async updateLearningPath(
    academyId: string,
    id: string,
    data: {
      title?: string;
      description?: string;
      language?: string;
      cefrLevel?: string;
      thumbnailUrl?: string;
      estimatedHours?: number;
      status?: LearningPathStatus;
    },
  ) {
    const lp = await this.lpRepo.findOne({
      where: { id, academyId },
    });

    if (!lp) {
      throw new NotFoundException("Learning path not found");
    }

    if (data.title !== undefined) lp.title = data.title;
    if (data.description !== undefined) lp.description = data.description;
    if (data.language !== undefined) lp.language = data.language;
    if (data.cefrLevel !== undefined) lp.cefrLevel = data.cefrLevel;
    if (data.thumbnailUrl !== undefined) lp.thumbnailUrl = data.thumbnailUrl;
    if (data.estimatedHours !== undefined)
      lp.estimatedHours = data.estimatedHours;
    if (data.status !== undefined) {
      if (!Object.values(LearningPathStatus).includes(data.status)) {
        throw new BadRequestException("Invalid status");
      }
      lp.status = data.status;
    }

    const saved = await this.lpRepo.save(lp);

    return {
      id: saved.id,
      title: saved.title,
      description: saved.description,
      language: saved.language,
      cefrLevel: saved.cefrLevel,
      status: saved.status,
      thumbnailUrl: saved.thumbnailUrl,
      estimatedHours: saved.estimatedHours,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  async deleteLearningPath(academyId: string, id: string) {
    const lp = await this.lpRepo.findOne({
      where: { id, academyId },
    });

    if (!lp) {
      throw new NotFoundException("Learning path not found");
    }

    // LearningPathLesson records cascade-delete; lessons themselves are preserved
    await this.lpRepo.remove(lp);
  }

  async listLessons(academyId: string, lpId: string) {
    const lp = await this.lpRepo.findOne({
      where: { id: lpId, academyId },
    });
    if (!lp) {
      throw new NotFoundException("Learning path not found");
    }

    const links = await this.lplRepo
      .createQueryBuilder("lpl")
      .leftJoinAndSelect("lpl.lesson", "lesson")
      .loadRelationCountAndMap("lesson.exerciseCount", "lesson.lessonExercises")
      .where("lpl.learningPathId = :lpId", { lpId })
      .orderBy("lpl.sortOrder", "ASC")
      .getMany();

    return {
      data: links.map((lpl) => ({
        id: lpl.lesson.id,
        title: lpl.lesson.title,
        description: lpl.lesson.description,
        language: lpl.lesson.language,
        cefrLevel: lpl.lesson.cefrLevel,
        status: lpl.lesson.status,
        exerciseCount:
          (lpl.lesson as unknown as { exerciseCount?: number }).exerciseCount ??
          0,
        sortOrder: lpl.sortOrder,
      })),
    };
  }

  async addLessons(
    academyId: string,
    lpId: string,
    lessonId?: string,
    lessonIds?: string[],
  ) {
    const lp = await this.lpRepo.findOne({
      where: { id: lpId, academyId },
    });
    if (!lp) {
      throw new NotFoundException("Learning path not found");
    }

    const ids: string[] = lessonIds ?? (lessonId ? [lessonId] : []);

    if (ids.length === 0) {
      throw new BadRequestException("lessonId or lessonIds is required");
    }

    // Validate all lessons belong to the same academy
    const lessons = await this.lessonRepo.find({
      where: ids.map((lid) => ({ id: lid, academyId })),
    });
    const validIds = new Set(lessons.map((l) => l.id));
    const invalid = ids.filter((lid) => !validIds.has(lid));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Lessons not found: ${invalid.join(", ")}`,
      );
    }

    // Get current max sortOrder
    const maxSort = await this.lplRepo
      .createQueryBuilder("lpl")
      .select("COALESCE(MAX(lpl.sortOrder), -1)", "maxSort")
      .where("lpl.learningPathId = :lpId", { lpId })
      .getRawOne();
    let nextSort = (maxSort?.maxSort ?? -1) + 1;

    const created: LearningPathLesson[] = [];
    for (const lid of ids) {
      // Skip duplicates
      const existing = await this.lplRepo.findOne({
        where: { learningPathId: lpId, lessonId: lid },
      });
      if (existing) continue;

      const link = new LearningPathLesson();
      link.learningPathId = lpId;
      link.lessonId = lid;
      link.sortOrder = nextSort++;
      const saved = await this.lplRepo.save(link);
      created.push(saved);
    }

    return { added: created.length };
  }

  async reorderLessons(
    academyId: string,
    lpId: string,
    lessonIds: string[],
  ) {
    const lp = await this.lpRepo.findOne({
      where: { id: lpId, academyId },
    });
    if (!lp) {
      throw new NotFoundException("Learning path not found");
    }

    if (!Array.isArray(lessonIds)) {
      throw new BadRequestException("lessonIds array is required");
    }

    // Fetch all links for this path
    const links = await this.lplRepo.find({
      where: { learningPathId: lpId },
    });
    const linkMap = new Map(links.map((l) => [l.lessonId, l]));

    // Update sort orders
    for (let i = 0; i < lessonIds.length; i++) {
      const link = linkMap.get(lessonIds[i]);
      if (link) {
        link.sortOrder = i;
        await this.lplRepo.save(link);
      }
    }

    return { reordered: true };
  }

  async removeLesson(
    academyId: string,
    lpId: string,
    lessonId: string,
  ) {
    const lp = await this.lpRepo.findOne({
      where: { id: lpId, academyId },
    });
    if (!lp) {
      throw new NotFoundException("Learning path not found");
    }

    if (!lessonId) {
      throw new BadRequestException("lessonId query param is required");
    }

    const link = await this.lplRepo.findOne({
      where: { learningPathId: lpId, lessonId },
    });

    if (!link) {
      throw new NotFoundException(
        "Lesson not linked to this learning path",
      );
    }

    await this.lplRepo.remove(link);
  }
}
