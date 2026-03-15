import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Lesson } from "../database/entities/lesson.entity.js";
import { LessonExercise } from "../database/entities/lesson-exercise.entity.js";
import { LessonVersion } from "../database/entities/lesson-version.entity.js";
import { Exercise } from "../database/entities/exercise.entity.js";
import { User } from "../database/entities/user.entity.js";
import { CourseLesson } from "../database/entities/course-lesson.entity.js";
import { LearningPathLesson } from "../database/entities/learning-path-lesson.entity.js";
import {
  LessonStatus,
  ExerciseSource,
  ExerciseType,
  EXERCISE_TYPE_CONFIG,
  UsageMetric,
  UserPlan,
} from "@langopia/shared/types";
import { EmbeddingService, DISTANCE_THRESHOLD_DEDUP, DISTANCE_THRESHOLD_TOPIC } from "../embedding/embedding.service.js";
import { TTSService } from "../tts/tts.service.js";
import { FileExtractService } from "../file-extract/file-extract.service.js";
import { UsageService } from "../usage/usage.service.js";

function serializeExercise(e: Exercise, sortOrder?: number) {
  return {
    id: e.id,
    type: e.type,
    title: e.title,
    targetSkill: e.targetSkill,
    topic: e.topic,
    language: e.language,
    instruction: e.instruction,
    content: e.content,
    options: e.options,
    correctAnswer: e.correctAnswer,
    explanation: e.explanation,
    cefrLevel: e.cefrLevel,
    source: e.source,
    audioUrl: e.audioUrl,
    videoUrl: e.videoUrl,
    imageUrl: e.imageUrl,
    ...(sortOrder !== undefined ? { sortOrder } : {}),
    createdAt: e.createdAt,
  };
}

@Injectable()
export class LessonsService {
  private readonly logger = new Logger(LessonsService.name);

  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
    @InjectRepository(LessonExercise)
    private readonly lessonExerciseRepo: Repository<LessonExercise>,
    @InjectRepository(LessonVersion)
    private readonly lessonVersionRepo: Repository<LessonVersion>,
    @InjectRepository(Exercise)
    private readonly exerciseRepo: Repository<Exercise>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(CourseLesson)
    private readonly courseLessonRepo: Repository<CourseLesson>,
    @InjectRepository(LearningPathLesson)
    private readonly learningPathLessonRepo: Repository<LearningPathLesson>,
    private readonly embeddingService: EmbeddingService,
    private readonly ttsService: TTSService,
    private readonly fileExtractService: FileExtractService,
    private readonly usageService: UsageService,
  ) {}

  async listLessons(
    academyId: string,
    opts: {
      language?: string;
      cefrLevel?: string;
      status?: LessonStatus;
      limit: number;
      offset: number;
    },
  ) {
    const { language, cefrLevel, status, limit, offset } = opts;

    const qb = this.lessonRepo
      .createQueryBuilder("lesson")
      .loadRelationCountAndMap("lesson.exerciseCount", "lesson.lessonExercises")
      .where("lesson.academyId = :academyId", { academyId })
      .orderBy("lesson.createdAt", "DESC")
      .take(limit)
      .skip(offset);

    if (language) qb.andWhere("lesson.language = :language", { language });
    if (cefrLevel)
      qb.andWhere("lesson.cefrLevel = :cefrLevel", { cefrLevel });
    if (status) qb.andWhere("lesson.status = :status", { status });

    const [lessons, total] = await qb.getManyAndCount();

    return {
      data: lessons.map((l: Lesson & { exerciseCount?: number }) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        language: l.language,
        cefrLevel: l.cefrLevel,
        status: l.status,
        exerciseCount: l.exerciseCount ?? 0,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      })),
      total,
      limit,
      offset,
    };
  }

  async createLesson(
    academyId: string,
    data: {
      title: string;
      cefrLevel: string;
      language?: string;
      description?: string;
    },
  ) {
    const lesson = new Lesson();
    lesson.academyId = academyId;
    lesson.title = data.title;
    lesson.language = data.language || "en";
    lesson.cefrLevel = data.cefrLevel;
    lesson.description = data.description ?? null;
    lesson.status = LessonStatus.DRAFT;

    const saved = await this.lessonRepo.save(lesson);

    return {
      id: saved.id,
      title: saved.title,
      description: saved.description,
      language: saved.language,
      cefrLevel: saved.cefrLevel,
      status: saved.status,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  async getLessonDetail(academyId: string, id: string) {
    const lesson = await this.lessonRepo.findOne({
      where: { id, academyId },
    });

    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    const exerciseCount = await this.lessonExerciseRepo.count({
      where: { lessonId: id },
    });

    return {
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      language: lesson.language,
      cefrLevel: lesson.cefrLevel,
      status: lesson.status,
      exerciseCount,
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
    };
  }

  async updateLesson(
    academyId: string,
    id: string,
    data: { title?: string; description?: string; status?: LessonStatus },
  ) {
    const lesson = await this.lessonRepo.findOne({
      where: { id, academyId },
    });

    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    if (data.title !== undefined) lesson.title = data.title;
    if (data.description !== undefined) lesson.description = data.description;
    if (data.status !== undefined) {
      if (!Object.values(LessonStatus).includes(data.status)) {
        throw new BadRequestException("Invalid status");
      }
      lesson.status = data.status;
    }

    const saved = await this.lessonRepo.save(lesson);

    return {
      id: saved.id,
      title: saved.title,
      description: saved.description,
      language: saved.language,
      cefrLevel: saved.cefrLevel,
      status: saved.status,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  async deleteLesson(academyId: string, id: string) {
    const lesson = await this.lessonRepo.findOne({
      where: { id, academyId },
    });

    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    const courseLinkCount = await this.courseLessonRepo.count({
      where: { lessonId: id },
    });
    const lpLinkCount = await this.learningPathLessonRepo.count({
      where: { lessonId: id },
    });
    if (courseLinkCount > 0 || lpLinkCount > 0) {
      throw new ConflictException(
        "Cannot delete lesson: it is linked to a course or learning path. Remove it from all courses and learning paths first.",
      );
    }

    // LessonExercise has CASCADE on delete, so links are removed automatically
    await this.lessonRepo.remove(lesson);
  }

  async listLessonExercises(
    academyId: string,
    lessonId: string,
    opts: { limit: number; offset: number },
  ) {
    const lesson = await this.lessonRepo.findOne({
      where: { id: lessonId, academyId },
    });
    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    const { limit, offset } = opts;

    const [links, total] = await this.lessonExerciseRepo.findAndCount({
      where: { lessonId },
      relations: ["exercise"],
      order: { sortOrder: "ASC", createdAt: "ASC" },
      take: limit,
      skip: offset,
    });

    return {
      data: links.map((le) => serializeExercise(le.exercise, le.sortOrder)),
      total,
      limit,
      offset,
    };
  }

  async generateExercises(
    academyId: string,
    lessonId: string,
    ownerId: string,
    input: {
      topic?: string;
      exercises: { type: string; count: number }[];
      sourceContent?: string;
    },
  ) {
    const lesson = await this.lessonRepo.findOne({
      where: { id: lessonId, academyId },
    });
    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    const { exercises } = input;

    if (!exercises || exercises.length === 0) {
      throw new BadRequestException("exercises array is required");
    }

    const effectiveTopic = input.topic || lesson.title;
    if (!effectiveTopic) {
      throw new BadRequestException("topic is required (pass in body)");
    }

    // Check AI token plan limit
    const user = await this.userRepo.findOne({ where: { id: ownerId } });
    const plan = (user?.plan as UserPlan) ?? UserPlan.FREE;
    const limitCheck = await this.usageService.checkPlanLimit(
      ownerId,
      plan,
      UsageMetric.AI_TOKENS,
    );
    if (!limitCheck.allowed) {
      throw new ForbiddenException(
        "AI token limit exceeded. Please upgrade your plan.",
      );
    }

    try {
      // Hybrid RAG dedup: find similar exercises via dual embeddings
      let existingSummaries: string[] | undefined;
      let searchCallback:
        | ((query: string) => Promise<{ results: string; tokensUsed: number }>)
        | undefined;
      try {
        const { candidates, tokensUsed: dedupTokens } =
          await this.embeddingService.findDedupCandidates({
            topic: effectiveTopic,
            materialContext: input.sourceContent,
            academyId,
            language: lesson.language || undefined,
            cefrLevel: lesson.cefrLevel || undefined,
          });
        if (dedupTokens > 0) {
          await this.usageService.incrementUsage(
            ownerId,
            academyId,
            UsageMetric.AI_TOKENS,
            dedupTokens,
          );
        }
        if (candidates.length > 0) {
          existingSummaries = candidates.map((e) => {
            const similarity =
              e.distance < DISTANCE_THRESHOLD_DEDUP
                ? "VERY_HIGH"
                : e.distance < DISTANCE_THRESHOLD_TOPIC
                  ? "HIGH"
                  : "MEDIUM";
            return `- [${similarity}] [${e.type}] "${e.title || "Untitled"}" | Skill: ${e.targetSkill} | Instruction: ${e.instruction} | Content: ${e.content.slice(0, 300)}${e.options ? ` | Options: ${e.options.join(", ")}` : ""}${e.correctAnswer ? ` | Answer: ${e.correctAnswer}` : ""}`;
          });
        }

        searchCallback = async (query: string) => {
          return this.embeddingService.searchExercisesForRAG({
            query,
            academyId,
            language: lesson.language || undefined,
            cefrLevel: lesson.cefrLevel || undefined,
            limit: 5,
          });
        };
      } catch (embedErr) {
        this.logger.warn(
          "Embedding search failed (continuing without dedup):",
          embedErr,
        );
      }

      const { generateExercisesByType } = await import(
        "@langopia/ai-pipeline"
      );

      const requests = exercises
        .filter((e) => e.count > 0)
        .map((e) => ({ type: e.type, count: e.count }));

      const result = await generateExercisesByType({
        requests,
        language: lesson.language,
        cefrLevel: lesson.cefrLevel,
        topic: effectiveTopic,
        sourceContent: input.sourceContent,
        existingSummaries,
        searchCallback,
      });

      // Get current max sortOrder
      const maxSort = await this.lessonExerciseRepo
        .createQueryBuilder("le")
        .select("COALESCE(MAX(le.sortOrder), -1)", "maxSort")
        .where("le.lessonId = :lessonId", { lessonId })
        .getRawOne();
      let nextSort = (maxSort?.maxSort ?? -1) + 1;

      const generated: Exercise[] = [];
      for (const ex of result.exercises) {
        const exercise = new Exercise();
        exercise.academyId = academyId;
        exercise.type = ex.type;
        exercise.title = ex.title ?? null;
        exercise.targetSkill = ex.targetSkill || "vocabulary";
        exercise.topic = effectiveTopic;
        exercise.language = lesson.language;
        exercise.instruction = ex.instruction;
        exercise.content = ex.content;
        exercise.options = ex.options ?? null;
        exercise.correctAnswer = ex.correctAnswer;
        exercise.explanation = ex.explanation;
        exercise.cefrLevel = lesson.cefrLevel;
        exercise.source = ExerciseSource.AI_LIVE;
        exercise.videoUrl = null;
        exercise.imageUrl = null;

        const savedExercise = await this.exerciseRepo.save(exercise);

        const link = new LessonExercise();
        link.lessonId = lessonId;
        link.exerciseId = savedExercise.id;
        link.sortOrder = nextSort++;
        await this.lessonExerciseRepo.save(link);

        generated.push(savedExercise);
      }

      // Track AI token usage
      if (result.tokensUsed > 0) {
        await this.usageService.incrementUsage(
          ownerId,
          academyId,
          UsageMetric.AI_TOKENS,
          result.tokensUsed,
        );
      }

      // Generate TTS audio for types that need it
      const AUDIO_KEYWORDS =
        /\b(listen|audio|dictation|pronunciat|spoken|oral|dialogue|hear)\b/i;
      if (this.ttsService.isTTSAvailable()) {
        const ttsLimit = await this.usageService.checkPlanLimit(
          ownerId,
          plan,
          UsageMetric.TTS_CHARACTERS,
        );
        if (ttsLimit.allowed) {
          for (const exercise of generated) {
            const config =
              EXERCISE_TYPE_CONFIG[exercise.type as ExerciseType];
            const needsAudio =
              config?.needsAudio ||
              AUDIO_KEYWORDS.test(exercise.type) ||
              AUDIO_KEYWORDS.test(exercise.targetSkill) ||
              AUDIO_KEYWORDS.test(exercise.instruction);
            if (!needsAudio) continue;
            try {
              const audioText = exercise.content;
              exercise.audioUrl =
                await this.ttsService.generateExerciseAudio(
                  audioText,
                  exercise.id,
                  exercise.language,
                );
              await this.exerciseRepo.save(exercise);
              await this.usageService.incrementUsage(
                ownerId,
                academyId,
                UsageMetric.TTS_CHARACTERS,
                audioText.length,
              );
            } catch (audioErr) {
              this.logger.error(
                `TTS failed for exercise ${exercise.id}:`,
                audioErr,
              );
            }
          }
        }
      }

      // Fire-and-forget: generate embeddings
      this.embeddingService
        .embedExercises(generated.map((e) => e.id))
        .then((tokens) => {
          if (tokens > 0) {
            this.usageService.incrementUsage(
              ownerId,
              academyId,
              UsageMetric.AI_TOKENS,
              tokens,
            );
          }
        })
        .catch((err) =>
          this.logger.error("Embedding generation failed:", err),
        );

      return {
        generated: generated.map((e) => serializeExercise(e)),
      };
    } catch (err) {
      if (
        err instanceof NotFoundException ||
        err instanceof BadRequestException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }
      this.logger.error("Failed to generate lesson exercises:", err);
      throw new BadRequestException("Failed to generate exercises");
    }
  }

  async extractTextFromFiles(
    files: { buffer: Buffer; filename: string; mimeType: string }[],
  ): Promise<string | undefined> {
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const MAX_TOTAL_SIZE = 30 * 1024 * 1024;

    let totalSize = 0;
    const validFiles: typeof files = [];
    for (const file of files) {
      if (!file || file.buffer.length === 0) continue;
      if (file.buffer.length > MAX_FILE_SIZE) {
        throw new BadRequestException(
          `File "${file.filename}" exceeds 10 MB limit.`,
        );
      }
      totalSize += file.buffer.length;
      if (totalSize > MAX_TOTAL_SIZE) {
        throw new BadRequestException("Total file size exceeds 30 MB limit.");
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return undefined;

    const parts: string[] = [];
    for (const file of validFiles) {
      const text = await this.fileExtractService.extractTextFromBuffer(
        file.buffer,
        file.filename,
        file.mimeType,
      );
      if (text.trim()) parts.push(`--- ${file.filename} ---\n${text}`);
    }

    return parts.length > 0 ? parts.join("\n\n") : undefined;
  }

  async linkExercises(
    academyId: string,
    lessonId: string,
    exerciseIds: string[],
  ) {
    const lesson = await this.lessonRepo.findOne({
      where: { id: lessonId, academyId },
    });
    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    // Get current max sortOrder
    const maxSort = await this.lessonExerciseRepo
      .createQueryBuilder("le")
      .select("COALESCE(MAX(le.sortOrder), -1)", "maxSort")
      .where("le.lessonId = :lessonId", { lessonId })
      .getRawOne();
    let nextSort = (maxSort?.maxSort ?? -1) + 1;

    const linked: ReturnType<typeof serializeExercise>[] = [];

    for (const exerciseId of exerciseIds) {
      // Verify exercise belongs to same academy
      const exercise = await this.exerciseRepo.findOne({
        where: { id: exerciseId, academyId },
      });
      if (!exercise) continue;

      // Check if already linked
      const existing = await this.lessonExerciseRepo.findOne({
        where: { lessonId, exerciseId },
      });
      if (existing) {
        linked.push(serializeExercise(exercise, existing.sortOrder));
        continue;
      }

      const link = new LessonExercise();
      link.lessonId = lessonId;
      link.exerciseId = exerciseId;
      link.sortOrder = nextSort++;
      await this.lessonExerciseRepo.save(link);

      linked.push(serializeExercise(exercise, link.sortOrder));
    }

    return { linked };
  }

  async unlinkExercise(
    academyId: string,
    lessonId: string,
    exerciseId: string,
  ) {
    const lesson = await this.lessonRepo.findOne({
      where: { id: lessonId, academyId },
    });
    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    if (!exerciseId) {
      throw new BadRequestException("exerciseId query param is required");
    }

    const link = await this.lessonExerciseRepo.findOne({
      where: { lessonId, exerciseId },
    });

    if (!link) {
      throw new NotFoundException("Exercise not linked to this lesson");
    }

    await this.lessonExerciseRepo.remove(link);
  }

  // ─── Versioning ──────────────────────────────────────────

  async createVersion(academyId: string, lessonId: string) {
    const lesson = await this.lessonRepo.findOne({
      where: { id: lessonId, academyId },
    });
    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    // Load exercises for snapshot
    const links = await this.lessonExerciseRepo.find({
      where: { lessonId },
      relations: ["exercise"],
      order: { sortOrder: "ASC", createdAt: "ASC" },
    });

    const exerciseSnapshot = links.map((le) => ({
      ...serializeExercise(le.exercise, le.sortOrder),
    }));

    // Get next version number
    const maxVersion = await this.lessonVersionRepo
      .createQueryBuilder("v")
      .select("COALESCE(MAX(v.version), 0)", "maxVersion")
      .where("v.lessonId = :lessonId", { lessonId })
      .getRawOne();
    const nextVersion = (maxVersion?.maxVersion ?? 0) + 1;

    const version = new LessonVersion();
    version.lessonId = lessonId;
    version.version = nextVersion;
    version.title = lesson.title;
    version.description = lesson.description;
    version.language = lesson.language;
    version.cefrLevel = lesson.cefrLevel;
    version.status = lesson.status;
    version.exerciseSnapshot = exerciseSnapshot;

    const saved = await this.lessonVersionRepo.save(version);

    return {
      id: saved.id,
      lessonId: saved.lessonId,
      version: saved.version,
      title: saved.title,
      status: saved.status,
      exerciseCount: exerciseSnapshot.length,
      createdAt: saved.createdAt,
    };
  }

  async listVersions(academyId: string, lessonId: string) {
    const lesson = await this.lessonRepo.findOne({
      where: { id: lessonId, academyId },
    });
    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    const versions = await this.lessonVersionRepo.find({
      where: { lessonId },
      order: { version: "DESC" },
      select: ["id", "lessonId", "version", "title", "status", "createdAt"],
    });

    return {
      data: versions.map((v) => ({
        id: v.id,
        lessonId: v.lessonId,
        version: v.version,
        title: v.title,
        status: v.status,
        createdAt: v.createdAt,
      })),
    };
  }

  async getVersion(academyId: string, lessonId: string, versionId: string) {
    const lesson = await this.lessonRepo.findOne({
      where: { id: lessonId, academyId },
    });
    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    const version = await this.lessonVersionRepo.findOne({
      where: { id: versionId, lessonId },
    });
    if (!version) {
      throw new NotFoundException("Version not found");
    }

    return {
      id: version.id,
      lessonId: version.lessonId,
      version: version.version,
      title: version.title,
      description: version.description,
      language: version.language,
      cefrLevel: version.cefrLevel,
      status: version.status,
      exerciseSnapshot: version.exerciseSnapshot,
      createdAt: version.createdAt,
    };
  }

  async restoreVersion(
    academyId: string,
    lessonId: string,
    versionId: string,
  ) {
    const lesson = await this.lessonRepo.findOne({
      where: { id: lessonId, academyId },
    });
    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    const version = await this.lessonVersionRepo.findOne({
      where: { id: versionId, lessonId },
    });
    if (!version) {
      throw new NotFoundException("Version not found");
    }

    // Update lesson fields
    lesson.title = version.title;
    lesson.description = version.description;
    lesson.language = version.language;
    lesson.cefrLevel = version.cefrLevel;
    lesson.status = version.status as LessonStatus;
    await this.lessonRepo.save(lesson);

    // Delete all current exercise links
    await this.lessonExerciseRepo.delete({ lessonId });

    // Recreate exercises from snapshot
    let sortOrder = 0;
    for (const snap of version.exerciseSnapshot) {
      const exercise = new Exercise();
      exercise.academyId = academyId;
      exercise.type = String(snap.type ?? "");
      exercise.title = snap.title ? String(snap.title) : null;
      exercise.targetSkill = String(snap.targetSkill ?? "vocabulary");
      exercise.topic = snap.topic ? String(snap.topic) : null;
      exercise.language = String(snap.language ?? lesson.language);
      exercise.instruction = String(snap.instruction ?? "");
      exercise.content = String(snap.content ?? "");
      exercise.options = Array.isArray(snap.options)
        ? snap.options.map(String)
        : null;
      exercise.correctAnswer = String(snap.correctAnswer ?? "");
      exercise.explanation = String(snap.explanation ?? "");
      exercise.cefrLevel = String(snap.cefrLevel ?? lesson.cefrLevel);
      exercise.source = (snap.source as ExerciseSource) ?? ExerciseSource.AI_LIVE;
      exercise.audioUrl = snap.audioUrl ? String(snap.audioUrl) : null;
      exercise.videoUrl = snap.videoUrl ? String(snap.videoUrl) : null;
      exercise.imageUrl = snap.imageUrl ? String(snap.imageUrl) : null;

      const savedExercise = await this.exerciseRepo.save(exercise);

      const link = new LessonExercise();
      link.lessonId = lessonId;
      link.exerciseId = savedExercise.id;
      link.sortOrder = sortOrder++;
      await this.lessonExerciseRepo.save(link);
    }

    return this.getLessonDetail(academyId, lessonId);
  }

  // ─── KPIs ────────────────────────────────────────────────

  async getLessonKpis(academyId: string, lessonId: string) {
    const lesson = await this.lessonRepo.findOne({
      where: { id: lessonId, academyId },
    });
    if (!lesson) {
      throw new NotFoundException("Lesson not found");
    }

    // Get exercise IDs linked to this lesson
    const exerciseLinks = await this.lessonExerciseRepo.find({
      where: { lessonId },
      select: ["exerciseId"],
    });
    const exerciseIds = exerciseLinks.map((l) => l.exerciseId);

    if (exerciseIds.length === 0) {
      return {
        classCount: 0,
        studentCount: 0,
        completionRate: 0,
        averageScore: 0,
      };
    }

    // Query ReportExercise for exercise-level metrics
    let averageScore = 0;
    let completionRate = 0;
    try {
      const scoreResult = await this.exerciseRepo.manager.query(
        `SELECT
          COALESCE(AVG(CASE WHEN re."isCorrect" THEN 1.0 ELSE 0.0 END) * 100, 0) as "averageScore",
          COUNT(DISTINCT re."classReportId") as "reportCount"
        FROM report_exercises re
        WHERE re."exerciseId" = ANY($1)`,
        [exerciseIds],
      );
      averageScore = Math.round(Number(scoreResult[0]?.averageScore ?? 0));

      // Completion rate: reports that have all exercises answered / total reports
      const totalReports = Number(scoreResult[0]?.reportCount ?? 0);
      if (totalReports > 0) {
        const completedResult = await this.exerciseRepo.manager.query(
          `SELECT COUNT(*) as "completed"
          FROM (
            SELECT re."classReportId"
            FROM report_exercises re
            WHERE re."exerciseId" = ANY($1)
            GROUP BY re."classReportId"
            HAVING COUNT(DISTINCT re."exerciseId") = $2
          ) sub`,
          [exerciseIds, exerciseIds.length],
        );
        completionRate = Math.round(
          (Number(completedResult[0]?.completed ?? 0) / totalReports) * 100,
        );
      }
    } catch (err) {
      this.logger.warn("Failed to query exercise metrics:", err);
    }

    // Class and student counts via class_reports
    let classCount = 0;
    let studentCount = 0;
    try {
      const classResult = await this.exerciseRepo.manager.query(
        `SELECT
          COUNT(DISTINCT cr."classId") as "classCount",
          COUNT(DISTINCT cr."studentId") as "studentCount"
        FROM class_reports cr
        INNER JOIN report_exercises re ON re."classReportId" = cr."id"
        WHERE re."exerciseId" = ANY($1)`,
        [exerciseIds],
      );
      classCount = Number(classResult[0]?.classCount ?? 0);
      studentCount = Number(classResult[0]?.studentCount ?? 0);
    } catch (err) {
      this.logger.warn("Failed to query class/student metrics:", err);
    }

    return {
      classCount,
      studentCount,
      completionRate,
      averageScore,
    };
  }
}
