import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  ExerciseSource,
  EXERCISE_TYPE_CONFIG,
  ExerciseType,
  UsageMetric,
  UserPlan,
} from "@langopia/shared/types";
import { Exercise } from "../database/entities/exercise.entity.js";
import { Lesson } from "../database/entities/lesson.entity.js";
import { LessonExercise } from "../database/entities/lesson-exercise.entity.js";
import { User } from "../database/entities/user.entity.js";
import { MediaItem } from "../database/entities/media-item.entity.js";
import { UsageService } from "../usage/usage.service.js";
import {
  EmbeddingService,
  DISTANCE_THRESHOLD_DEDUP,
  DISTANCE_THRESHOLD_TOPIC,
} from "../embedding/embedding.service.js";
import { TTSService } from "../tts/tts.service.js";
import { FileExtractService } from "../file-extract/file-extract.service.js";
import { MediaProcessingService } from "../media-processing/media-processing.service.js";

export interface SerializedExercise {
  id: string;
  type: string;
  title: string | null;
  targetSkill: string;
  topic: string | null;
  language: string;
  instruction: string;
  content: string;
  options: string[] | null;
  correctAnswer: string;
  explanation: string;
  cefrLevel: string;
  source: ExerciseSource;
  audioUrl: string | null;
  videoUrl: string | null;
  imageUrl: string | null;
  lesson?: { id: string; title: string } | null;
  createdAt: Date;
}

const AUDIO_KEYWORDS =
  /\b(listen|audio|dictation|pronunciat|spoken|oral|dialogue|hear)\b/i;

@Injectable()
export class ExercisesService {
  private readonly logger = new Logger(ExercisesService.name);

  constructor(
    @InjectRepository(Exercise)
    private readonly exerciseRepo: Repository<Exercise>,
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
    @InjectRepository(LessonExercise)
    private readonly lessonExerciseRepo: Repository<LessonExercise>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(MediaItem)
    private readonly mediaItemRepo: Repository<MediaItem>,
    private readonly usage: UsageService,
    private readonly embedding: EmbeddingService,
    private readonly tts: TTSService,
    private readonly fileExtract: FileExtractService,
    private readonly mediaProcessing: MediaProcessingService,
  ) {}

  serializeExercise(
    e: Exercise,
    lesson?: { id: string; title: string } | null,
  ): SerializedExercise {
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
      lesson: lesson !== undefined ? lesson : undefined,
      createdAt: e.createdAt,
    };
  }

  // GET /v1/exercises
  async listExercises(
    academyId: string,
    opts: {
      source?: string;
      language?: string;
      cefrLevel?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const limit = Math.min(opts.limit ?? 50, 100);
    const offset = opts.offset ?? 0;

    const qb = this.exerciseRepo
      .createQueryBuilder("exercise")
      .leftJoinAndSelect(
        "exercise.lessonExercises",
        "le",
      )
      .leftJoinAndSelect("le.lesson", "lesson")
      .where("exercise.academyId = :academyId", { academyId })
      .orderBy("exercise.createdAt", "DESC")
      .take(limit)
      .skip(offset);

    if (opts.source)
      qb.andWhere("exercise.source = :source", { source: opts.source });
    if (opts.language)
      qb.andWhere("exercise.language = :language", {
        language: opts.language,
      });
    if (opts.cefrLevel)
      qb.andWhere("exercise.cefrLevel = :cefrLevel", {
        cefrLevel: opts.cefrLevel,
      });

    const [exercises, total] = await qb.getManyAndCount();

    return {
      data: exercises.map((e) => {
        const links = (e.lessonExercises as unknown as { lesson?: { id: string; title: string } }[]) ?? [];
        const firstLesson = links[0]?.lesson;
        const lesson = firstLesson
          ? { id: firstLesson.id, title: firstLesson.title }
          : null;
        return this.serializeExercise(e, lesson);
      }),
      total,
      limit,
      offset,
    };
  }

  // POST /v1/exercises — generate via AI
  async generateExercises(
    academyId: string,
    ownerId: string,
    body: {
      topic: string;
      language?: string;
      cefrLevel?: string;
      materialContext?: string;
      mediaItemIds?: string[];
      lessonId?: string;
      exercises: { type: string; count: number }[];
    },
  ) {
    const {
      topic,
      language = "en",
      cefrLevel = "B1",
      materialContext,
      mediaItemIds,
      lessonId,
      exercises: exercisePlan,
    } = body;

    if (!topic) {
      throw new BadRequestException("topic is required");
    }

    if (!exercisePlan || exercisePlan.length === 0) {
      throw new BadRequestException(
        "exercises array is required (e.g. [{type: 'tap_to_complete', count: 2}])",
      );
    }

    // Validate types against config
    const validTypes = new Set(Object.values(ExerciseType) as string[]);
    const invalidTypes = exercisePlan.filter((e) => !validTypes.has(e.type));
    if (invalidTypes.length > 0) {
      throw new BadRequestException(
        `Invalid exercise types: ${invalidTypes.map((e) => e.type).join(", ")}`,
      );
    }

    // Check AI token plan limit before generating
    const user = await this.userRepo.findOne({ where: { id: ownerId } });
    const plan = (user?.plan as UserPlan) ?? UserPlan.FREE;
    const limitCheck = await this.usage.checkPlanLimit(
      ownerId,
      plan,
      UsageMetric.AI_TOKENS,
    );
    if (!limitCheck.allowed) {
      throw new ForbiddenException(
        "AI token limit exceeded for your plan. Please upgrade to continue generating exercises.",
      );
    }

    // RAG: resolve mediaItemIds to structured chunk context (overrides raw materialContext)
    let sourceContent = materialContext;
    if (mediaItemIds && mediaItemIds.length > 0) {
      try {
        const ragQuery = `${topic} ${language} ${cefrLevel}`;
        const { chunks, tokensUsed: ragTokens } =
          await this.mediaProcessing.findRelevantChunks({
            mediaItemIds,
            query: ragQuery,
            topK: 10,
          });
        if (ragTokens > 0) {
          await this.usage.incrementUsage(
            ownerId,
            academyId,
            UsageMetric.AI_TOKENS,
            ragTokens,
          );
        }
        if (chunks.length > 0) {
          sourceContent =
            this.mediaProcessing.formatChunksAsContext(chunks);
        }
      } catch (ragErr) {
        this.logger.warn(
          "RAG chunk retrieval failed (falling back to materialContext):",
          ragErr,
        );
      }
    }

    try {
      // Hybrid RAG dedup: find similar exercises via dual embeddings
      let existingSummaries: string[] | undefined;
      let searchCallback:
        | ((query: string) => Promise<{ results: string; tokensUsed: number }>)
        | undefined;
      try {
        const { candidates, tokensUsed: dedupTokens } =
          await this.embedding.findDedupCandidates({
            topic,
            materialContext,
            academyId,
            language: language || undefined,
            cefrLevel: cefrLevel || undefined,
          });
        if (dedupTokens > 0) {
          await this.usage.incrementUsage(
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

        // Create searchCallback for GPT tool calling
        searchCallback = async (query: string) => {
          return this.embedding.searchExercisesForRAG({
            query,
            academyId,
            language: language || undefined,
            cefrLevel: cefrLevel || undefined,
            limit: 5,
          });
        };
      } catch (embedErr) {
        this.logger.warn(
          "Embedding search failed (continuing without dedup):",
          embedErr,
        );
      }

      // Generate exercises by type
      const { generateExercisesByType } = await import(
        "@langopia/ai-pipeline"
      );

      const requests = exercisePlan
        .filter((e) => e.count > 0)
        .map((e) => ({ type: e.type, count: e.count }));

      const result = await generateExercisesByType({
        requests,
        language: language || "en",
        cefrLevel: cefrLevel || "B1",
        topic,
        sourceContent,
        existingSummaries,
        searchCallback,
      });

      // Save exercises
      const saved: Exercise[] = [];
      const needsAudioMap = new Map<string, boolean>();

      for (const ex of result.exercises) {
        const exercise = new Exercise();
        exercise.academyId = academyId;
        exercise.type = ex.type;
        exercise.title = ex.title ?? null;
        exercise.targetSkill = ex.targetSkill || "vocabulary";
        exercise.topic = topic;
        exercise.language = language || "en";
        exercise.instruction = ex.instruction;
        exercise.content = ex.content;
        exercise.options = ex.options ?? null;
        exercise.correctAnswer = ex.correctAnswer;
        exercise.explanation = ex.explanation;
        exercise.cefrLevel = cefrLevel || "B1";
        exercise.source = ExerciseSource.AI_LIVE;
        exercise.videoUrl = null;
        exercise.imageUrl = null;
        const savedEx = await this.exerciseRepo.save(exercise);
        if (ex.needsAudio) needsAudioMap.set(savedEx.id, true);
        saved.push(savedEx);
      }

      if (result.tokensUsed > 0) {
        await this.usage.incrementUsage(
          ownerId,
          academyId,
          UsageMetric.AI_TOKENS,
          result.tokensUsed,
        );
      }

      // Link to lesson
      for (const ex of saved) {
        await this.linkToLesson(ex.id, lessonId, academyId);
      }

      // TTS
      await this.generateTTS(saved, ownerId, academyId, plan, needsAudioMap);

      // Fire-and-forget: generate embeddings
      this.embedding
        .embedExercises(saved.map((e) => e.id))
        .then((tokens) => {
          if (tokens > 0)
            this.usage.incrementUsage(
              ownerId,
              academyId,
              UsageMetric.AI_TOKENS,
              tokens,
            );
        })
        .catch((err) =>
          this.logger.error("Embedding generation failed:", err),
        );

      return { data: saved.map((e) => this.serializeExercise(e)) };
    } catch (err) {
      this.logger.error("Failed to generate exercises:", err);
      throw new InternalServerErrorException(
        "Failed to generate exercises",
      );
    }
  }

  // POST /v1/exercises/single — create one exercise (prompt or manual)
  async createSingleExercise(
    academyId: string,
    ownerId: string,
    body: {
      mode: "prompt" | "manual";
      language: string;
      cefrLevel: string;
      prompt?: string;
      topic?: string;
      type?: string;
      targetSkill?: string;
      title?: string;
      instruction?: string;
      content?: string;
      options?: string[];
      correctAnswer?: string;
      explanation?: string;
      videoUrl?: string;
      imageUrl?: string;
    },
  ) {
    if (body.mode === "manual") {
      if (!body.type) throw new BadRequestException("type is required for manual mode");
      if (!body.instruction) throw new BadRequestException("instruction is required for manual mode");
      if (!body.content) throw new BadRequestException("content is required for manual mode");

      const exercise = new Exercise();
      exercise.academyId = academyId;
      exercise.type = body.type;
      exercise.title = body.title ?? null;
      exercise.targetSkill = body.targetSkill || "vocabulary";
      exercise.topic = body.topic ?? null;
      exercise.language = body.language;
      exercise.instruction = body.instruction;
      exercise.content = body.content;
      exercise.options = body.options ?? null;
      exercise.correctAnswer = body.correctAnswer ?? "";
      exercise.explanation = body.explanation ?? "";
      exercise.cefrLevel = body.cefrLevel;
      exercise.source = ExerciseSource.MANUAL;
      exercise.videoUrl = body.videoUrl ?? null;
      exercise.imageUrl = body.imageUrl ?? null;
      const saved = await this.exerciseRepo.save(exercise);

      // Fire-and-forget: generate embedding
      this.embedding
        .embedExercise(saved.id)
        .then((tokens) => {
          if (tokens > 0)
            this.usage.incrementUsage(ownerId, academyId, UsageMetric.AI_TOKENS, tokens);
        })
        .catch((err) => this.logger.error("Embedding generation failed:", err));

      return { data: this.serializeExercise(saved) };
    }

    // Prompt mode: generate a single exercise via AI
    if (!body.prompt) throw new BadRequestException("prompt is required for prompt mode");

    const user = await this.userRepo.findOne({ where: { id: ownerId } });
    const plan = (user?.plan as UserPlan) ?? UserPlan.FREE;
    const limitCheck = await this.usage.checkPlanLimit(ownerId, plan, UsageMetric.AI_TOKENS);
    if (!limitCheck.allowed) {
      throw new ForbiddenException("AI token limit exceeded for your plan.");
    }

    const validTypes = new Set(Object.values(ExerciseType) as string[]);
    const exerciseType = body.type && validTypes.has(body.type) ? body.type : ExerciseType.TAP_TO_COMPLETE;

    try {
      const { generateExercisesByType } = await import("@langopia/ai-pipeline");

      const result = await generateExercisesByType({
        requests: [{ type: exerciseType, count: 1 }],
        language: body.language,
        cefrLevel: body.cefrLevel,
        topic: body.topic || "general",
        customPrompt: body.prompt,
      });

      if (result.exercises.length === 0) {
        throw new InternalServerErrorException("AI failed to generate exercise");
      }

      const ex = result.exercises[0];
      const exercise = new Exercise();
      exercise.academyId = academyId;
      exercise.type = ex.type;
      exercise.title = ex.title ?? null;
      exercise.targetSkill = ex.targetSkill || "vocabulary";
      exercise.topic = body.topic ?? null;
      exercise.language = body.language;
      exercise.instruction = ex.instruction;
      exercise.content = ex.content;
      exercise.options = ex.options ?? null;
      exercise.correctAnswer = ex.correctAnswer;
      exercise.explanation = ex.explanation;
      exercise.cefrLevel = body.cefrLevel;
      exercise.source = ExerciseSource.AI_LIVE;
      exercise.videoUrl = null;
      exercise.imageUrl = null;
      const saved = await this.exerciseRepo.save(exercise);

      if (result.tokensUsed > 0) {
        await this.usage.incrementUsage(ownerId, academyId, UsageMetric.AI_TOKENS, result.tokensUsed);
      }

      // TTS if needed
      const needsAudioMap = new Map<string, boolean>();
      if (ex.needsAudio) needsAudioMap.set(saved.id, true);
      await this.generateTTS([saved], ownerId, academyId, plan, needsAudioMap);

      // Fire-and-forget: generate embedding
      this.embedding
        .embedExercise(saved.id)
        .then((tokens) => {
          if (tokens > 0)
            this.usage.incrementUsage(ownerId, academyId, UsageMetric.AI_TOKENS, tokens);
        })
        .catch((err) => this.logger.error("Embedding generation failed:", err));

      return { data: this.serializeExercise(saved) };
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof ForbiddenException) throw err;
      this.logger.error("Failed to create single exercise:", err);
      throw new InternalServerErrorException("Failed to create exercise");
    }
  }

  // GET /v1/exercises/:id
  async getExercise(id: string, academyId: string) {
    const exercise = await this.exerciseRepo.findOne({
      where: { id, academyId },
    });

    if (!exercise) {
      throw new NotFoundException("Exercise not found");
    }

    return this.serializeExercise(exercise);
  }

  // DELETE /v1/exercises/:id
  async deleteExercise(id: string, academyId: string) {
    const exercise = await this.exerciseRepo.findOne({
      where: { id, academyId },
    });

    if (!exercise) {
      throw new NotFoundException("Exercise not found");
    }

    const lessonLinkCount = await this.lessonExerciseRepo.count({
      where: { exerciseId: id },
    });
    if (lessonLinkCount > 0) {
      throw new ConflictException(
        "Cannot delete exercise: it is linked to one or more lessons. Remove it from all lessons first.",
      );
    }

    await this.exerciseRepo.remove(exercise);

    return { deleted: true };
  }

  // PATCH /v1/exercises/:id
  async updateExercise(
    id: string,
    academyId: string,
    ownerId: string,
    body: Record<string, unknown>,
  ) {
    const exercise = await this.exerciseRepo.findOne({
      where: { id, academyId },
    });

    if (!exercise) {
      throw new NotFoundException("Exercise not found");
    }

    const editableFields = [
      "title",
      "instruction",
      "content",
      "options",
      "correctAnswer",
      "explanation",
      "cefrLevel",
      "targetSkill",
      "topic",
      "videoUrl",
      "imageUrl",
    ] as const;
    const isContentEdit = editableFields.some(
      (f) => body[f] !== undefined,
    );

    if (!isContentEdit) {
      throw new BadRequestException("No editable fields provided");
    }

    if (body.title !== undefined)
      exercise.title = body.title as string;
    if (body.instruction !== undefined)
      exercise.instruction = body.instruction as string;
    if (body.content !== undefined)
      exercise.content = body.content as string;
    if (body.options !== undefined)
      exercise.options = body.options as string[];
    if (body.correctAnswer !== undefined)
      exercise.correctAnswer = body.correctAnswer as string;
    if (body.explanation !== undefined)
      exercise.explanation = body.explanation as string;
    if (body.cefrLevel !== undefined)
      exercise.cefrLevel = body.cefrLevel as string;
    if (body.targetSkill !== undefined)
      exercise.targetSkill = body.targetSkill as string;
    if (body.topic !== undefined)
      exercise.topic = body.topic as string;
    if (body.videoUrl !== undefined)
      exercise.videoUrl = body.videoUrl as string;
    if (body.imageUrl !== undefined)
      exercise.imageUrl = body.imageUrl as string;

    await this.exerciseRepo.save(exercise);

    // Re-embed if semantic fields changed
    const embeddingFields = [
      "title",
      "instruction",
      "content",
      "topic",
      "targetSkill",
      "cefrLevel",
    ] as const;
    if (embeddingFields.some((f) => body[f] !== undefined)) {
      this.embedding
        .embedExercise(exercise.id)
        .then((tokens) => {
          if (tokens > 0)
            this.usage.incrementUsage(
              ownerId,
              academyId,
              UsageMetric.AI_TOKENS,
              tokens,
            );
        })
        .catch((err) =>
          this.logger.error("Embedding re-generation failed:", err),
        );
    }

    return this.serializeExercise(exercise);
  }

  // PUT /v1/exercises/:id — regenerate with AI
  async regenerateExercise(
    id: string,
    academyId: string,
    ownerId: string,
    customPrompt?: string,
  ) {
    const existing = await this.exerciseRepo.findOne({
      where: { id, academyId },
    });

    if (!existing) {
      throw new NotFoundException("Exercise not found");
    }

    try {
      const { generateExercisesByType } = await import(
        "@langopia/ai-pipeline"
      );

      const result = await generateExercisesByType({
        requests: [{ type: existing.type, count: 1 }],
        language: existing.language,
        cefrLevel: existing.cefrLevel,
        topic: existing.topic ?? "general",
        customPrompt,
      });

      if (result.exercises.length === 0) {
        throw new InternalServerErrorException(
          "AI failed to generate exercise",
        );
      }

      const generatedEx = result.exercises[0];

      // Track AI token usage
      if (result.tokensUsed > 0) {
        await this.usage.incrementUsage(
          ownerId,
          academyId,
          UsageMetric.AI_TOKENS,
          result.tokensUsed,
        );
      }

      // Update existing exercise in-place (preserves ID + lesson links)
      existing.title = generatedEx.title ?? existing.title;
      existing.instruction = generatedEx.instruction;
      existing.content = generatedEx.content;
      existing.options = generatedEx.options ?? null;
      existing.correctAnswer = generatedEx.correctAnswer;
      existing.explanation = generatedEx.explanation;
      existing.source = ExerciseSource.AI_LIVE;
      existing.audioUrl = null; // reset — will regenerate below if needed

      const saved = await this.exerciseRepo.save(existing);

      // Generate TTS audio
      const config =
        EXERCISE_TYPE_CONFIG[saved.type as ExerciseType];
      const needsAudio =
        config?.needsAudio ||
        generatedEx.needsAudio ||
        AUDIO_KEYWORDS.test(saved.type) ||
        AUDIO_KEYWORDS.test(saved.targetSkill) ||
        AUDIO_KEYWORDS.test(saved.instruction);

      if (needsAudio) {
        if (this.tts.isTTSAvailable()) {
          const user = await this.userRepo.findOne({
            where: { id: ownerId },
          });
          const ttsLimit = await this.usage.checkPlanLimit(
            ownerId,
            (user?.plan as UserPlan) ?? UserPlan.FREE,
            UsageMetric.TTS_CHARACTERS,
          );
          if (ttsLimit.allowed) {
            try {
              const audioText = saved.content;
              saved.audioUrl =
                await this.tts.generateExerciseAudio(
                  audioText,
                  saved.id,
                  saved.language,
                );
              await this.exerciseRepo.save(saved);
              await this.usage.incrementUsage(
                ownerId,
                academyId,
                UsageMetric.TTS_CHARACTERS,
                audioText.length,
              );
            } catch (audioErr) {
              this.logger.error(
                `TTS generation failed for exercise ${saved.id}:`,
                audioErr,
              );
            }
          }
        }
      }

      // Fire-and-forget: generate embedding
      this.embedding
        .embedExercise(saved.id)
        .then((tokens) => {
          if (tokens > 0)
            this.usage.incrementUsage(
              ownerId,
              academyId,
              UsageMetric.AI_TOKENS,
              tokens,
            );
        })
        .catch((err) =>
          this.logger.error("Embedding generation failed:", err),
        );

      return this.serializeExercise(saved);
    } catch (err) {
      if (
        err instanceof NotFoundException ||
        err instanceof InternalServerErrorException
      ) {
        throw err;
      }
      this.logger.error("Failed to regenerate exercise:", err);
      throw new InternalServerErrorException(
        "Failed to regenerate exercise",
      );
    }
  }

  // POST /v1/exercises/search — semantic vector search
  async searchExercises(
    academyId: string,
    ownerId: string,
    body: {
      query: string;
      limit?: number;
      language?: string;
      cefrLevel?: string;
      targetSkill?: string;
      excludeIds?: string[];
      mode?: "topic" | "content";
      distanceThreshold?: number;
    },
  ) {
    const { query, limit = 10, language, cefrLevel, targetSkill, excludeIds, mode, distanceThreshold } = body;

    if (!query || typeof query !== "string") {
      throw new BadRequestException("query string is required");
    }

    try {
      const { exercises, tokensUsed } =
        await this.embedding.findSimilarExercises({
          query,
          academyId,
          limit: Math.min(limit, 50),
          language,
          cefrLevel,
          targetSkill,
          excludeIds,
          mode,
          distanceThreshold,
        });

      if (tokensUsed > 0) {
        await this.usage.incrementUsage(
          ownerId,
          academyId,
          UsageMetric.AI_TOKENS,
          tokensUsed,
        );
      }

      return {
        data: exercises.map((e) => ({
          id: e.id,
          type: e.type,
          title: e.title,
          targetSkill: e.targetSkill,
          topic: e.topic,
          language: e.language,
          instruction: e.instruction,
          content: e.content,
          options: e.options,
          cefrLevel: e.cefrLevel,
          source: e.source,
          audioUrl: e.audioUrl,
          videoUrl: e.videoUrl,
          imageUrl: e.imageUrl,
          distance: e.distance,
          createdAt: e.createdAt,
        })),
        total: exercises.length,
      };
    } catch (err) {
      this.logger.error("Semantic search failed:", err);
      throw new InternalServerErrorException("Semantic search failed");
    }
  }

  // POST /v1/exercises/analyze — analyze material and suggest exercise plan
  async analyzeMaterial(
    academyId: string,
    ownerId: string,
    opts: {
      topic?: string;
      language?: string;
      cefrLevel?: string;
      materialContext?: string;
      mediaItemIds?: string[];
    },
    file?: Express.Multer.File,
  ) {
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const MAX_TOTAL_SIZE = 30 * 1024 * 1024;

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

    let topic = opts.topic;
    let language = opts.language || "en";
    let cefrLevel = opts.cefrLevel || "B1";
    let sourceContent = opts.materialContext;

    // Extract CEFR level & language from selected media items as defaults
    if (opts.mediaItemIds && opts.mediaItemIds.length > 0) {
      try {
        const mediaItems = await this.mediaItemRepo
          .createQueryBuilder("mi")
          .select(["mi.detectedCefrLevel", "mi.detectedLanguage"])
          .where("mi.id IN (:...ids)", { ids: opts.mediaItemIds })
          .andWhere("mi.academyId = :academyId", { academyId })
          .getMany();

        // Use first media item's detected values as defaults when user didn't provide explicit values
        for (const mi of mediaItems) {
          if (!opts.cefrLevel && mi.detectedCefrLevel) {
            cefrLevel = mi.detectedCefrLevel;
            break;
          }
        }
        for (const mi of mediaItems) {
          if (!opts.language && mi.detectedLanguage) {
            language = mi.detectedLanguage;
            break;
          }
        }
      } catch (err) {
        this.logger.warn("Failed to query media item metadata:", err);
      }
    }

    // Handle file upload
    if (file) {
      if (file.size === 0) {
        // Skip empty file
      } else if (file.size > MAX_FILE_SIZE) {
        throw new BadRequestException(
          `File "${file.originalname}" exceeds 10 MB limit.`,
        );
      } else if (file.size > MAX_TOTAL_SIZE) {
        throw new BadRequestException(
          "Total file size exceeds 30 MB limit.",
        );
      } else {
        const text = await this.fileExtract.extractTextFromBuffer(
          file.buffer,
          file.originalname,
          file.mimetype,
        );
        if (text.trim()) {
          sourceContent = `--- ${file.originalname} ---\n${text}`;
        }
      }
    }

    // RAG: resolve mediaItemIds to structured chunk context (overrides raw materialContext)
    if (opts.mediaItemIds && opts.mediaItemIds.length > 0) {
      try {
        const ragQuery = `${topic || ""} ${language} ${cefrLevel}`;
        const { chunks, tokensUsed: ragTokens } =
          await this.mediaProcessing.findRelevantChunks({
            mediaItemIds: opts.mediaItemIds,
            query: ragQuery,
            topK: 10,
          });
        if (ragTokens > 0) {
          await this.usage.incrementUsage(
            ownerId,
            academyId,
            UsageMetric.AI_TOKENS,
            ragTokens,
          );
        }
        if (chunks.length > 0) {
          sourceContent =
            this.mediaProcessing.formatChunksAsContext(chunks);
        }
      } catch (ragErr) {
        this.logger.warn(
          "RAG chunk retrieval failed (falling back to materialContext):",
          ragErr,
        );
      }
    }

    if (!topic && !sourceContent) {
      throw new BadRequestException(
        "Either topic, file upload, or media selection is required",
      );
    }

    try {
      const { analyzeExerciseMaterial } = await import(
        "@langopia/ai-pipeline"
      );

      const result = await analyzeExerciseMaterial({
        materialText: sourceContent,
        topic,
        language,
        cefrLevel,
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

      // Find existing similar exercises via embeddings
      let existingExercises: unknown[] = [];
      try {
        const effectiveTopic = result.detectedTopic || topic || "";
        if (effectiveTopic) {
          const { candidates, tokensUsed: dedupTokens } =
            await this.embedding.findDedupCandidates({
              topic: effectiveTopic,
              materialContext: sourceContent,
              academyId,
              language,
              cefrLevel,
            });
          if (dedupTokens > 0) {
            await this.usage.incrementUsage(
              ownerId,
              academyId,
              UsageMetric.AI_TOKENS,
              dedupTokens,
            );
          }
          existingExercises = candidates.map((e) => ({
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
            audioUrl: e.audioUrl,
            distance: e.distance,
            matchType: e.matchType,
            similarity:
              e.distance < DISTANCE_THRESHOLD_DEDUP
                ? "very_high"
                : e.distance < DISTANCE_THRESHOLD_TOPIC
                  ? "high"
                  : "medium",
          }));
        }
      } catch (embedErr) {
        this.logger.warn(
          "Embedding search failed (continuing without existing exercises):",
          embedErr,
        );
      }

      return {
        detectedTopic: result.detectedTopic,
        detectedLanguage: result.detectedLanguage,
        detectedCefrLevel: result.detectedCefrLevel,
        suggestedTitle: result.suggestedTitle,
        suggestedDescription: result.suggestedDescription,
        materialSummary: result.materialSummary,
        suggestions: result.suggestions,
        existingExercises,
      };
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }
      this.logger.error("Failed to analyze material:", err);
      throw new InternalServerErrorException(
        "Failed to analyze material",
      );
    }
  }

  // POST /v1/exercises/analyze/refine — refine exercise plan via chat
  async refinePlan(
    academyId: string,
    ownerId: string,
    opts: {
      currentPlan: {
        detectedTopic: string;
        materialSummary: string;
        suggestions: { type: string; count: number; reason: string }[];
      };
      userMessage: string;
      language?: string;
      cefrLevel?: string;
      materialContext?: string;
      mediaItemIds?: string[];
    },
  ) {
    const language = opts.language || "en";
    const cefrLevel = opts.cefrLevel || "B1";

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

    // RAG: resolve mediaItemIds to context
    let materialText = opts.materialContext;
    if (opts.mediaItemIds && opts.mediaItemIds.length > 0) {
      try {
        const ragQuery = `${opts.currentPlan.detectedTopic} ${language} ${cefrLevel}`;
        const { chunks, tokensUsed: ragTokens } =
          await this.mediaProcessing.findRelevantChunks({
            mediaItemIds: opts.mediaItemIds,
            query: ragQuery,
            topK: 10,
          });
        if (ragTokens > 0) {
          await this.usage.incrementUsage(
            ownerId,
            academyId,
            UsageMetric.AI_TOKENS,
            ragTokens,
          );
        }
        if (chunks.length > 0) {
          materialText =
            this.mediaProcessing.formatChunksAsContext(chunks);
        }
      } catch (ragErr) {
        this.logger.warn(
          "RAG chunk retrieval failed (falling back to materialContext):",
          ragErr,
        );
      }
    }

    try {
      const { refineExercisePlan } = await import("@langopia/ai-pipeline");

      const result = await refineExercisePlan({
        currentPlan: opts.currentPlan,
        userMessage: opts.userMessage,
        language,
        cefrLevel,
        materialText,
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

      return {
        detectedTopic: result.detectedTopic,
        materialSummary: result.materialSummary,
        suggestions: result.suggestions,
        aiResponse: result.aiResponse,
      };
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }
      this.logger.error("Failed to refine plan:", err);
      throw new InternalServerErrorException("Failed to refine plan");
    }
  }

  // POST /v1/exercises/preview — generate exercises without saving
  async previewExercises(
    academyId: string,
    ownerId: string,
    opts: {
      topic?: string;
      language?: string;
      cefrLevel?: string;
      materialContext?: string;
      mediaItemIds?: string[];
      exercises?: { type: string; count: number }[];
    },
    file?: Express.Multer.File,
  ) {
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const MAX_TOTAL_SIZE = 30 * 1024 * 1024;

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

    let topic = opts.topic;
    let language = opts.language || "en";
    let cefrLevel = opts.cefrLevel || "B1";
    let sourceContent = opts.materialContext;

    // Extract CEFR level & language from selected media items as defaults
    if (opts.mediaItemIds && opts.mediaItemIds.length > 0) {
      try {
        const mediaItems = await this.mediaItemRepo
          .createQueryBuilder("mi")
          .select(["mi.detectedCefrLevel", "mi.detectedLanguage"])
          .where("mi.id IN (:...ids)", { ids: opts.mediaItemIds })
          .andWhere("mi.academyId = :academyId", { academyId })
          .getMany();

        for (const mi of mediaItems) {
          if (!opts.cefrLevel && mi.detectedCefrLevel) {
            cefrLevel = mi.detectedCefrLevel;
            break;
          }
        }
        for (const mi of mediaItems) {
          if (!opts.language && mi.detectedLanguage) {
            language = mi.detectedLanguage;
            break;
          }
        }
      } catch (err) {
        this.logger.warn("Failed to query media item metadata:", err);
      }
    }

    // Handle file upload
    if (file) {
      if (file.size === 0) {
        // Skip empty file
      } else if (file.size > MAX_FILE_SIZE) {
        throw new BadRequestException(
          `File "${file.originalname}" exceeds 10 MB limit.`,
        );
      } else if (file.size > MAX_TOTAL_SIZE) {
        throw new BadRequestException(
          "Total file size exceeds 30 MB limit.",
        );
      } else {
        const text = await this.fileExtract.extractTextFromBuffer(
          file.buffer,
          file.originalname,
          file.mimetype,
        );
        if (text.trim()) {
          sourceContent = `--- ${file.originalname} ---\n${text}`;
        }
      }
    }

    // RAG: resolve mediaItemIds to structured chunk context
    if (opts.mediaItemIds && opts.mediaItemIds.length > 0) {
      try {
        const ragQuery = `${topic || ""} ${language} ${cefrLevel}`;
        const { chunks, tokensUsed: ragTokens } =
          await this.mediaProcessing.findRelevantChunks({
            mediaItemIds: opts.mediaItemIds,
            query: ragQuery,
            topK: 10,
          });
        if (ragTokens > 0) {
          await this.usage.incrementUsage(
            ownerId,
            academyId,
            UsageMetric.AI_TOKENS,
            ragTokens,
          );
        }
        if (chunks.length > 0) {
          sourceContent =
            this.mediaProcessing.formatChunksAsContext(chunks);
        }
      } catch (ragErr) {
        this.logger.warn(
          "RAG chunk retrieval failed (falling back to materialContext):",
          ragErr,
        );
      }
    }

    if (!topic && !sourceContent) {
      throw new BadRequestException(
        "Either topic, file upload, or media selection is required",
      );
    }

    try {
      // Step 1: Analyze material
      const { analyzeExerciseMaterial } = await import(
        "@langopia/ai-pipeline"
      );

      const analysisResult = await analyzeExerciseMaterial({
        materialText: sourceContent,
        topic,
        language,
        cefrLevel,
      });

      if (analysisResult.tokensUsed > 0) {
        await this.usage.incrementUsage(
          ownerId,
          academyId,
          UsageMetric.AI_TOKENS,
          analysisResult.tokensUsed,
        );
      }

      // Find existing similar exercises
      let existingExercises: unknown[] = [];
      let existingSummaries: string[] | undefined;
      let searchCallback:
        | ((query: string) => Promise<{ results: string; tokensUsed: number }>)
        | undefined;
      try {
        const effectiveTopic = analysisResult.detectedTopic || topic || "";
        if (effectiveTopic) {
          const { candidates, tokensUsed: dedupTokens } =
            await this.embedding.findDedupCandidates({
              topic: effectiveTopic,
              materialContext: sourceContent,
              academyId,
              language,
              cefrLevel,
            });
          if (dedupTokens > 0) {
            await this.usage.incrementUsage(
              ownerId,
              academyId,
              UsageMetric.AI_TOKENS,
              dedupTokens,
            );
          }
          if (candidates.length > 0) {
            existingExercises = candidates.map((e) => ({
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
              audioUrl: e.audioUrl,
              distance: e.distance,
              matchType: e.matchType,
              similarity:
                e.distance < DISTANCE_THRESHOLD_DEDUP
                  ? "very_high"
                  : e.distance < DISTANCE_THRESHOLD_TOPIC
                    ? "high"
                    : "medium",
            }));

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
            return this.embedding.searchExercisesForRAG({
              query,
              academyId,
              language: language || undefined,
              cefrLevel: cefrLevel || undefined,
              limit: 5,
            });
          };
        }
      } catch (embedErr) {
        this.logger.warn(
          "Embedding search failed (continuing without existing exercises):",
          embedErr,
        );
      }

      // Step 2: Generate exercises (use provided plan or AI suggestions)
      const exercisePlan = opts.exercises && opts.exercises.length > 0
        ? opts.exercises
        : analysisResult.suggestions;

      const requests = exercisePlan
        .filter((e) => e.count > 0)
        .map((e) => ({ type: e.type, count: e.count }));

      const { generateExercisesByType } = await import(
        "@langopia/ai-pipeline"
      );

      const genResult = await generateExercisesByType({
        requests,
        language: language || "en",
        cefrLevel: cefrLevel || "B1",
        topic: analysisResult.detectedTopic || topic || "",
        sourceContent,
        existingSummaries,
        searchCallback,
      });

      if (genResult.tokensUsed > 0) {
        await this.usage.incrementUsage(
          ownerId,
          academyId,
          UsageMetric.AI_TOKENS,
          genResult.tokensUsed,
        );
      }

      // Assign tempIds — no DB writes
      const exercises = genResult.exercises.map((ex) => ({
        tempId: crypto.randomUUID(),
        type: ex.type,
        title: ex.title,
        instruction: ex.instruction,
        content: ex.content,
        options: ex.options,
        correctAnswer: ex.correctAnswer,
        explanation: ex.explanation,
        cefrLevel: ex.cefrLevel || cefrLevel,
        targetSkill: ex.targetSkill || "vocabulary",
        needsAudio: ex.needsAudio,
      }));

      return {
        detectedTopic: analysisResult.detectedTopic,
        detectedLanguage: analysisResult.detectedLanguage,
        detectedCefrLevel: analysisResult.detectedCefrLevel,
        suggestedTitle: analysisResult.suggestedTitle,
        suggestedDescription: analysisResult.suggestedDescription,
        materialSummary: analysisResult.materialSummary,
        existingExercises,
        exercises,
      };
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }
      this.logger.error("Failed to preview exercises:", err);
      throw new InternalServerErrorException(
        "Failed to preview exercises",
      );
    }
  }

  // POST /v1/exercises/preview/refine — refine previewed exercises via chat
  async refinePreview(
    academyId: string,
    ownerId: string,
    opts: {
      currentExercises: {
        tempId: string;
        type: string;
        title?: string;
        instruction: string;
        content: string;
        options?: string[];
        correctAnswer: string;
        explanation: string;
        cefrLevel: string;
        targetSkill: string;
      }[];
      userMessage: string;
      language?: string;
      cefrLevel?: string;
      materialContext?: string;
      topic?: string;
    },
  ) {
    const language = opts.language || "en";
    const cefrLevel = opts.cefrLevel || "B1";

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

    try {
      const { refineExercises } = await import("@langopia/ai-pipeline");

      const result = await refineExercises({
        currentExercises: opts.currentExercises,
        userMessage: opts.userMessage,
        language,
        cefrLevel,
        materialText: opts.materialContext,
        topic: opts.topic,
      });

      if (result.tokensUsed > 0) {
        await this.usage.incrementUsage(
          ownerId,
          academyId,
          UsageMetric.AI_TOKENS,
          result.tokensUsed,
        );
      }

      return {
        exercises: result.exercises,
        aiResponse: result.aiResponse,
      };
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }
      this.logger.error("Failed to refine preview:", err);
      throw new InternalServerErrorException("Failed to refine exercises");
    }
  }

  // POST /v1/exercises/bulk — bulk save previewed exercises
  async bulkSaveExercises(
    academyId: string,
    ownerId: string,
    body: {
      lessonId?: string;
      topic?: string;
      exercises: {
        type: string;
        title?: string;
        targetSkill: string;
        instruction: string;
        content: string;
        options?: string[];
        correctAnswer: string;
        explanation: string;
        cefrLevel: string;
        language: string;
        needsAudio?: boolean;
      }[];
    },
  ) {
    if (!body.exercises || body.exercises.length === 0) {
      throw new BadRequestException("exercises array is required");
    }

    const user = await this.userRepo.findOne({ where: { id: ownerId } });
    const plan = (user?.plan as UserPlan) ?? UserPlan.FREE;

    const saved: Exercise[] = [];
    const needsAudioMap = new Map<string, boolean>();

    for (const ex of body.exercises) {
      const exercise = new Exercise();
      exercise.academyId = academyId;
      exercise.type = ex.type;
      exercise.title = ex.title ?? null;
      exercise.targetSkill = ex.targetSkill || "vocabulary";
      exercise.topic = body.topic ?? null;
      exercise.language = ex.language || "en";
      exercise.instruction = ex.instruction;
      exercise.content = ex.content;
      exercise.options = ex.options ?? null;
      exercise.correctAnswer = ex.correctAnswer;
      exercise.explanation = ex.explanation;
      exercise.cefrLevel = ex.cefrLevel || "B1";
      exercise.source = ExerciseSource.AI_LIVE;
      exercise.videoUrl = null;
      exercise.imageUrl = null;
      const savedEx = await this.exerciseRepo.save(exercise);
      if (ex.needsAudio) needsAudioMap.set(savedEx.id, true);
      saved.push(savedEx);
    }

    // Link to lesson
    for (const ex of saved) {
      await this.linkToLesson(ex.id, body.lessonId, academyId);
    }

    // Fire-and-forget: TTS
    this.generateTTS(saved, ownerId, academyId, plan, needsAudioMap).catch(
      (err) => this.logger.error("TTS generation failed:", err),
    );

    // Fire-and-forget: embeddings
    this.embedding
      .embedExercises(saved.map((e) => e.id))
      .then((tokens) => {
        if (tokens > 0)
          this.usage.incrementUsage(
            ownerId,
            academyId,
            UsageMetric.AI_TOKENS,
            tokens,
          );
      })
      .catch((err) =>
        this.logger.error("Embedding generation failed:", err),
      );

    return { data: saved.map((e) => this.serializeExercise(e)) };
  }

  // Helper: link exercise to lesson
  private async linkToLesson(
    exerciseId: string,
    lessonId: string | undefined,
    academyId: string,
  ): Promise<void> {
    if (!lessonId) return;
    const lesson = await this.lessonRepo.findOne({
      where: { id: lessonId, academyId },
    });
    if (!lesson) return;

    const existing = await this.lessonExerciseRepo.findOne({
      where: { lessonId, exerciseId },
    });
    if (existing) return;

    const maxSort = await this.lessonExerciseRepo
      .createQueryBuilder("le")
      .select("COALESCE(MAX(le.sortOrder), -1)", "maxSort")
      .where("le.lessonId = :lessonId", { lessonId })
      .getRawOne();

    const link = new LessonExercise();
    link.lessonId = lessonId;
    link.exerciseId = exerciseId;
    link.sortOrder = (maxSort?.maxSort ?? -1) + 1;
    await this.lessonExerciseRepo.save(link);
  }

  // Helper: generate TTS audio for exercises that need it
  private async generateTTS(
    exercises: Exercise[],
    ownerId: string,
    academyId: string,
    plan: UserPlan,
    needsAudioMap?: Map<string, boolean>,
  ): Promise<void> {
    const audioExercises = exercises.filter((e) => {
      // 1. Check config needsAudio
      const config = EXERCISE_TYPE_CONFIG[e.type as ExerciseType];
      if (config?.needsAudio) return true;
      // 2. Check AI flag
      if (needsAudioMap?.has(e.id)) return needsAudioMap.get(e.id);
      // 3. Keyword heuristic
      return (
        AUDIO_KEYWORDS.test(e.type) ||
        AUDIO_KEYWORDS.test(e.targetSkill) ||
        AUDIO_KEYWORDS.test(e.instruction)
      );
    });
    if (audioExercises.length === 0) {
      this.logger.warn("TTS skipped: no exercises matched audio filter");
      return;
    }
    if (!this.tts.isTTSAvailable()) {
      this.logger.warn("TTS skipped: no TTS provider configured");
      return;
    }
    const ttsLimit = await this.usage.checkPlanLimit(
      ownerId,
      plan,
      UsageMetric.TTS_CHARACTERS,
    );
    if (!ttsLimit.allowed) {
      this.logger.warn("TTS skipped: plan limit reached");
      return;
    }
    for (const exercise of audioExercises) {
      try {
        const audioText = exercise.type === "podcast"
          ? exercise.content.split("---QUESTIONS---")[0].trim()
          : exercise.content;
        exercise.audioUrl = await this.tts.generateExerciseAudio(
          audioText,
          exercise.id,
          exercise.language,
        );
        await this.exerciseRepo.save(exercise);
        await this.usage.incrementUsage(
          ownerId,
          academyId,
          UsageMetric.TTS_CHARACTERS,
          audioText.length,
        );
      } catch (audioErr) {
        this.logger.error(
          `TTS generation failed for exercise ${exercise.id}:`,
          audioErr,
        );
      }
    }
  }
}
