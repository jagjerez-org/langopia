import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Exercise, LessonExercise, Lesson, User } from "@/entities";
import { authenticateApiKey, checkPlanLimit, incrementUsage } from "@/lib/api-auth";
import { ExerciseSource, EXERCISE_TYPE_CONFIG, ExerciseType, UsageMetric, UserPlan } from "@langopia/shared/types";

function serializeExercise(e: Exercise) {
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
    createdAt: e.createdAt,
  };
}

// GET /api/v1/exercises - List exercises for the academy
export async function GET(req: NextRequest) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const ds = await getDataSource();

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(req.nextUrl.searchParams.get("offset") ?? "0");
  const source = req.nextUrl.searchParams.get("source") as ExerciseSource | null;
  const language = req.nextUrl.searchParams.get("language");
  const cefrLevel = req.nextUrl.searchParams.get("cefrLevel");

  const qb = ds.getRepository(Exercise)
    .createQueryBuilder("exercise")
    .where("exercise.academyId = :academyId", { academyId: academy.id })
    .orderBy("exercise.createdAt", "DESC")
    .take(limit)
    .skip(offset);

  if (source) qb.andWhere("exercise.source = :source", { source });
  if (language) qb.andWhere("exercise.language = :language", { language });
  if (cefrLevel) qb.andWhere("exercise.cefrLevel = :cefrLevel", { cefrLevel });

  const [exercises, total] = await qb.getManyAndCount();

  return NextResponse.json({
    data: exercises.map(serializeExercise),
    total,
    limit,
    offset,
  });
}

// POST /api/v1/exercises - Generate exercises via AI
export async function POST(req: NextRequest) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy, ownerId } = authResult;

  const body = await req.json();
  const {
    topic,
    language = "en",
    cefrLevel = "B1",
    materialContext,
    lessonId,
    exercises: exercisePlan,
  } = body as {
    topic?: string;
    language?: string;
    cefrLevel?: string;
    materialContext?: string;
    lessonId?: string;
    exercises?: { type: string; count: number }[];
  };

  if (!topic) {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }

  if (!exercisePlan || exercisePlan.length === 0) {
    return NextResponse.json(
      { error: "exercises array is required (e.g. [{type: 'tap_to_complete', count: 2}])" },
      { status: 400 }
    );
  }

  // Validate types against config
  const validTypes = new Set(Object.values(ExerciseType) as string[]);
  const invalidTypes = exercisePlan.filter((e) => !validTypes.has(e.type));
  if (invalidTypes.length > 0) {
    return NextResponse.json(
      { error: `Invalid exercise types: ${invalidTypes.map((e) => e.type).join(", ")}` },
      { status: 400 }
    );
  }

  // Check AI token plan limit before generating
  const ds = await getDataSource();
  const user = await ds.getRepository(User).findOne({ where: { id: ownerId } });
  const plan = (user?.plan as UserPlan) ?? UserPlan.FREE;
  const limitCheck = await checkPlanLimit(ownerId, plan, UsageMetric.AI_TOKENS);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { error: "AI token limit exceeded for your plan. Please upgrade to continue generating exercises." },
      { status: 403 }
    );
  }

  // Helper: link exercise to lesson
  async function linkToLesson(exerciseId: string) {
    if (!lessonId) return;
    const lesson = await ds.getRepository(Lesson).findOne({
      where: { id: lessonId, academyId: academy.id },
    });
    if (!lesson) return;

    const existing = await ds.getRepository(LessonExercise).findOne({
      where: { lessonId, exerciseId },
    });
    if (existing) return;

    const maxSort = await ds.getRepository(LessonExercise)
      .createQueryBuilder("le")
      .select("COALESCE(MAX(le.sortOrder), -1)", "maxSort")
      .where("le.lessonId = :lessonId", { lessonId })
      .getRawOne();

    const link = new LessonExercise();
    link.lessonId = lessonId;
    link.exerciseId = exerciseId;
    link.sortOrder = (maxSort?.maxSort ?? -1) + 1;
    await ds.getRepository(LessonExercise).save(link);
  }

  // Helper: generate TTS audio for exercises that need it
  const AUDIO_KEYWORDS = /\b(listen|audio|dictation|pronunciat|spoken|oral|dialogue|hear)\b/i;

  async function generateTTS(exercises: Exercise[], needsAudioMap?: Map<string, boolean>) {
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
    if (audioExercises.length === 0) return;
    const { isTTSAvailable, generateExerciseAudio } = await import("@/lib/tts");
    if (!isTTSAvailable()) return;
    const ttsLimit = await checkPlanLimit(ownerId, plan, UsageMetric.TTS_CHARACTERS);
    if (!ttsLimit.allowed) return;
    for (const exercise of audioExercises) {
      try {
        const audioText = exercise.content;
        exercise.audioUrl = await generateExerciseAudio(audioText, exercise.id, exercise.language);
        await ds.getRepository(Exercise).save(exercise);
        await incrementUsage(ownerId, academy.id, UsageMetric.TTS_CHARACTERS, audioText.length);
      } catch (audioErr) {
        console.error(`TTS generation failed for exercise ${exercise.id}:`, audioErr);
      }
    }
  }

  try {
    // Hybrid RAG dedup: find similar exercises via dual embeddings
    let existingSummaries: string[] | undefined;
    let searchCallback: ((query: string) => Promise<{ results: string; tokensUsed: number }>) | undefined;
    try {
      const { findDedupCandidates, searchExercisesForRAG, DISTANCE_THRESHOLD_DEDUP, DISTANCE_THRESHOLD_TOPIC } = await import("@/lib/embeddings");
      const { candidates, tokensUsed: dedupTokens } = await findDedupCandidates({
        topic,
        materialContext,
        academyId: academy.id,
        language: language || undefined,
        cefrLevel: cefrLevel || undefined,
      });
      if (dedupTokens > 0) {
        await incrementUsage(ownerId, academy.id, UsageMetric.AI_TOKENS, dedupTokens);
      }
      if (candidates.length > 0) {
        existingSummaries = candidates.map((e) => {
          const similarity = e.distance < DISTANCE_THRESHOLD_DEDUP
            ? "VERY_HIGH"
            : e.distance < DISTANCE_THRESHOLD_TOPIC
              ? "HIGH"
              : "MEDIUM";
          return `- [${similarity}] [${e.type}] "${e.title || "Untitled"}" | Skill: ${e.targetSkill} | Instruction: ${e.instruction} | Content: ${e.content.slice(0, 300)}${e.options ? ` | Options: ${e.options.join(", ")}` : ""}${e.correctAnswer ? ` | Answer: ${e.correctAnswer}` : ""}`;
        });
      }

      // Create searchCallback for GPT tool calling
      searchCallback = async (query: string) => {
        return searchExercisesForRAG({
          query,
          academyId: academy.id,
          language: language || undefined,
          cefrLevel: cefrLevel || undefined,
          limit: 5,
        });
      };
    } catch (embedErr) {
      console.warn("Embedding search failed (continuing without dedup):", embedErr);
    }

    // Generate exercises by type
    const { generateExercisesByType } = await import("@langopia/ai-pipeline");

    const requests = exercisePlan
      .filter((e) => e.count > 0)
      .map((e) => ({ type: e.type, count: e.count }));

    const result = await generateExercisesByType({
      requests,
      language: language || "en",
      cefrLevel: cefrLevel || "B1",
      topic,
      sourceContent: materialContext,
      existingSummaries,
      searchCallback,
    });

    // Save exercises
    const saved: Exercise[] = [];
    const needsAudioMap = new Map<string, boolean>();

    for (const ex of result.exercises) {
      const exercise = new Exercise();
      exercise.academyId = academy.id;
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
      const savedEx = await ds.getRepository(Exercise).save(exercise);
      if (ex.needsAudio) needsAudioMap.set(savedEx.id, true);
      saved.push(savedEx);
    }

    if (result.tokensUsed > 0) {
      await incrementUsage(ownerId, academy.id, UsageMetric.AI_TOKENS, result.tokensUsed);
    }

    // Link to lesson
    for (const ex of saved) {
      await linkToLesson(ex.id);
    }

    // TTS
    await generateTTS(saved, needsAudioMap);

    // Fire-and-forget: generate embeddings
    import("@/lib/embeddings").then(({ embedExercises }) => {
      embedExercises(saved.map((e) => e.id))
        .then((tokens) => { if (tokens > 0) incrementUsage(ownerId, academy.id, UsageMetric.AI_TOKENS, tokens); })
        .catch((err) => console.error("Embedding generation failed:", err));
    });

    return NextResponse.json(
      { data: saved.map(serializeExercise) },
      { status: 201 }
    );
  } catch (err) {
    console.error("Failed to generate exercises:", err);
    return NextResponse.json({ error: "Failed to generate exercises" }, { status: 500 });
  }
}
