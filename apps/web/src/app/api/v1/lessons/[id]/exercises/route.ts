import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Lesson, LessonExercise, Exercise, User } from "@/entities";
import { authenticateApiKey, checkPlanLimit, incrementUsage } from "@/lib/api-auth";
import { ExerciseSource, EXERCISE_TYPE_CONFIG, ExerciseType, UsageMetric, UserPlan } from "@langopia/shared/types";

type Params = { params: Promise<{ id: string }> };

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

// GET /api/v1/lessons/:id/exercises - List exercises linked to this lesson
export async function GET(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  const lesson = await ds.getRepository(Lesson).findOne({
    where: { id, academyId: academy.id },
  });
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "100"), 200);
  const offset = parseInt(req.nextUrl.searchParams.get("offset") ?? "0");

  const [links, total] = await ds.getRepository(LessonExercise).findAndCount({
    where: { lessonId: id },
    relations: ["exercise"],
    order: { sortOrder: "ASC", createdAt: "ASC" },
    take: limit,
    skip: offset,
  });

  return NextResponse.json({
    data: links.map((le) => serializeExercise(le.exercise, le.sortOrder)),
    total,
    limit,
    offset,
  });
}

// POST /api/v1/lessons/:id/exercises - Generate exercises for this lesson
export async function POST(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy, ownerId } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  const lesson = await ds.getRepository(Lesson).findOne({
    where: { id, academyId: academy.id },
  });
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  // Support both JSON and multipart/form-data
  let topic: string | undefined;
  let sourceContent: string | undefined;
  let exercises: { type: string; count: number }[] | undefined;

  const contentType = req.headers.get("content-type") ?? "";
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_TOTAL_SIZE = 30 * 1024 * 1024;

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    topic = (formData.get("topic") as string) || undefined;
    const exercisesJson = formData.get("exercises") as string | null;
    if (exercisesJson) {
      try { exercises = JSON.parse(exercisesJson); } catch { /* ignore */ }
    }

    const files = formData.getAll("file") as File[];
    if (files.length > 0) {
      let totalSize = 0;
      const validFiles: File[] = [];
      for (const file of files) {
        if (!file || file.size === 0) continue;
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { error: `File "${file.name}" exceeds 10 MB limit.` },
            { status: 400 }
          );
        }
        totalSize += file.size;
        if (totalSize > MAX_TOTAL_SIZE) {
          return NextResponse.json(
            { error: "Total file size exceeds 30 MB limit." },
            { status: 400 }
          );
        }
        validFiles.push(file);
      }
      if (validFiles.length > 0) {
        const { extractTextFromFile } = await import("@/lib/file-extract");
        const parts: string[] = [];
        for (const file of validFiles) {
          const text = await extractTextFromFile(file);
          if (text.trim()) parts.push(`--- ${file.name} ---\n${text}`);
        }
        sourceContent = parts.join("\n\n");
      }
    }
  } else {
    const body = await req.json();
    topic = body.topic;
    exercises = body.exercises;
  }

  if (!exercises || exercises.length === 0) {
    return NextResponse.json({ error: "exercises array is required" }, { status: 400 });
  }

  const effectiveTopic = topic || lesson.title;
  if (!effectiveTopic) {
    return NextResponse.json({ error: "topic is required (pass in body)" }, { status: 400 });
  }

  // Check AI token plan limit
  const user = await ds.getRepository(User).findOne({ where: { id: ownerId } });
  const plan = (user?.plan as UserPlan) ?? UserPlan.FREE;
  const limitCheck = await checkPlanLimit(ownerId, plan, UsageMetric.AI_TOKENS);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { error: "AI token limit exceeded. Please upgrade your plan." },
      { status: 403 }
    );
  }

  try {
    // Hybrid RAG dedup: find similar exercises via dual embeddings
    let existingSummaries: string[] | undefined;
    let searchCallback: ((query: string) => Promise<{ results: string; tokensUsed: number }>) | undefined;
    try {
      const { findDedupCandidates, searchExercisesForRAG, DISTANCE_THRESHOLD_DEDUP, DISTANCE_THRESHOLD_TOPIC } = await import("@/lib/embeddings");
      const { candidates, tokensUsed: dedupTokens } = await findDedupCandidates({
        topic: effectiveTopic,
        materialContext: sourceContent,
        academyId: academy.id,
        language: lesson.language || undefined,
        cefrLevel: lesson.cefrLevel || undefined,
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

      searchCallback = async (query: string) => {
        return searchExercisesForRAG({
          query,
          academyId: academy.id,
          language: lesson.language || undefined,
          cefrLevel: lesson.cefrLevel || undefined,
          limit: 5,
        });
      };
    } catch (embedErr) {
      console.warn("Embedding search failed (continuing without dedup):", embedErr);
    }

    const { generateExercisesByType } = await import("@langopia/ai-pipeline");

    const requests = exercises
      .filter((e) => e.count > 0)
      .map((e) => ({ type: e.type, count: e.count }));

    const result = await generateExercisesByType({
      requests,
      language: lesson.language,
      cefrLevel: lesson.cefrLevel,
      topic: effectiveTopic,
      sourceContent,
      existingSummaries,
      searchCallback,
    });

    // Get current max sortOrder
    const maxSort = await ds.getRepository(LessonExercise)
      .createQueryBuilder("le")
      .select("COALESCE(MAX(le.sortOrder), -1)", "maxSort")
      .where("le.lessonId = :lessonId", { lessonId: id })
      .getRawOne();
    let nextSort = (maxSort?.maxSort ?? -1) + 1;

    const generated: Exercise[] = [];
    for (const ex of result.exercises) {
      const exercise = new Exercise();
      exercise.academyId = academy.id;
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

      const savedExercise = await ds.getRepository(Exercise).save(exercise);

      const link = new LessonExercise();
      link.lessonId = id;
      link.exerciseId = savedExercise.id;
      link.sortOrder = nextSort++;
      await ds.getRepository(LessonExercise).save(link);

      generated.push(savedExercise);
    }

    // Track AI token usage
    if (result.tokensUsed > 0) {
      await incrementUsage(ownerId, academy.id, UsageMetric.AI_TOKENS, result.tokensUsed);
    }

    // Generate TTS audio for types that need it
    const AUDIO_KEYWORDS = /\b(listen|audio|dictation|pronunciat|spoken|oral|dialogue|hear)\b/i;
    const { isTTSAvailable, generateExerciseAudio } = await import("@/lib/tts");
    if (isTTSAvailable()) {
      const ttsLimit = await checkPlanLimit(ownerId, plan, UsageMetric.TTS_CHARACTERS);
      if (ttsLimit.allowed) {
        for (const exercise of generated) {
          const config = EXERCISE_TYPE_CONFIG[exercise.type as ExerciseType];
          const needsAudio = config?.needsAudio ||
            AUDIO_KEYWORDS.test(exercise.type) ||
            AUDIO_KEYWORDS.test(exercise.targetSkill) ||
            AUDIO_KEYWORDS.test(exercise.instruction);
          if (!needsAudio) continue;
          try {
            const audioText = exercise.content;
            exercise.audioUrl = await generateExerciseAudio(audioText, exercise.id, exercise.language);
            await ds.getRepository(Exercise).save(exercise);
            await incrementUsage(ownerId, academy.id, UsageMetric.TTS_CHARACTERS, audioText.length);
          } catch (audioErr) {
            console.error(`TTS failed for exercise ${exercise.id}:`, audioErr);
          }
        }
      }
    }

    // Fire-and-forget: generate embeddings
    import("@/lib/embeddings").then(({ embedExercises }) => {
      embedExercises(generated.map((e) => e.id))
        .then((tokens) => { if (tokens > 0) incrementUsage(ownerId, academy.id, UsageMetric.AI_TOKENS, tokens); })
        .catch((err) => console.error("Embedding generation failed:", err));
    });

    return NextResponse.json(
      { generated: generated.map((e) => serializeExercise(e)) },
      { status: 201 }
    );
  } catch (err) {
    console.error("Failed to generate lesson exercises:", err);
    return NextResponse.json({ error: "Failed to generate exercises" }, { status: 500 });
  }
}

// PATCH /api/v1/lessons/:id/exercises - Link existing exercises to lesson
export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  const lesson = await ds.getRepository(Lesson).findOne({
    where: { id, academyId: academy.id },
  });
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const body = await req.json();
  const exerciseIds: string[] = body.exerciseIds;
  if (!exerciseIds || !Array.isArray(exerciseIds) || exerciseIds.length === 0) {
    return NextResponse.json({ error: "exerciseIds array is required" }, { status: 400 });
  }

  // Get current max sortOrder
  const maxSort = await ds.getRepository(LessonExercise)
    .createQueryBuilder("le")
    .select("COALESCE(MAX(le.sortOrder), -1)", "maxSort")
    .where("le.lessonId = :lessonId", { lessonId: id })
    .getRawOne();
  let nextSort = (maxSort?.maxSort ?? -1) + 1;

  const linked: ReturnType<typeof serializeExercise>[] = [];

  for (const exerciseId of exerciseIds) {
    // Verify exercise belongs to same academy
    const exercise = await ds.getRepository(Exercise).findOne({
      where: { id: exerciseId, academyId: academy.id },
    });
    if (!exercise) continue;

    // Check if already linked
    const existing = await ds.getRepository(LessonExercise).findOne({
      where: { lessonId: id, exerciseId },
    });
    if (existing) {
      linked.push(serializeExercise(exercise, existing.sortOrder));
      continue;
    }

    const link = new LessonExercise();
    link.lessonId = id;
    link.exerciseId = exerciseId;
    link.sortOrder = nextSort++;
    await ds.getRepository(LessonExercise).save(link);

    linked.push(serializeExercise(exercise, link.sortOrder));
  }

  return NextResponse.json({ linked }, { status: 200 });
}

// DELETE /api/v1/lessons/:id/exercises - Unlink an exercise from lesson
export async function DELETE(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  const lesson = await ds.getRepository(Lesson).findOne({
    where: { id, academyId: academy.id },
  });
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const exerciseId = req.nextUrl.searchParams.get("exerciseId");
  if (!exerciseId) {
    return NextResponse.json({ error: "exerciseId query param is required" }, { status: 400 });
  }

  const link = await ds.getRepository(LessonExercise).findOne({
    where: { lessonId: id, exerciseId },
  });

  if (!link) {
    return NextResponse.json({ error: "Exercise not linked to this lesson" }, { status: 404 });
  }

  await ds.getRepository(LessonExercise).remove(link);

  return new NextResponse(null, { status: 204 });
}
