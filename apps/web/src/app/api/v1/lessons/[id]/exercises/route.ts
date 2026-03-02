import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Lesson, LessonExercise, Exercise, ExerciseTemplate, User } from "@/entities";
import { authenticateApiKey, checkPlanLimit, incrementUsage } from "@/lib/api-auth";
import { ExerciseSource, UsageMetric, UserPlan } from "@langopia/shared/types";

type Params = { params: Promise<{ id: string }> };

// GET /api/v1/lessons/:id/exercises - List exercises linked to this lesson
export async function GET(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  // Verify lesson belongs to academy
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
    data: links.map((le) => ({
      id: le.exercise.id,
      type: le.exercise.type,
      targetSkill: le.exercise.targetSkill,
      topic: le.exercise.topic,
      language: le.exercise.language,
      instruction: le.exercise.instruction,
      content: le.exercise.content,
      options: le.exercise.options,
      correctAnswer: le.exercise.correctAnswer,
      explanation: le.exercise.explanation,
      cefrLevel: le.exercise.cefrLevel,
      source: le.exercise.source,
      templateId: le.exercise.templateId,
      audioUrl: le.exercise.audioUrl,
      sortOrder: le.sortOrder,
      createdAt: le.exercise.createdAt,
    })),
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

  // Verify lesson belongs to academy
  const lesson = await ds.getRepository(Lesson).findOne({
    where: { id, academyId: academy.id },
  });
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  // Support both JSON and multipart/form-data
  let topic: string | undefined;
  let sourceContent: string | undefined;
  let templates: { templateId: string; count: number }[] | undefined;

  const contentType = req.headers.get("content-type") ?? "";
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_TOTAL_SIZE = 30 * 1024 * 1024;

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    topic = (formData.get("topic") as string) || undefined;
    const templatesJson = formData.get("templates") as string | null;
    if (templatesJson) {
      try { templates = JSON.parse(templatesJson); } catch { /* ignore */ }
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
    templates = body.templates;
  }

  if (!templates || templates.length === 0) {
    return NextResponse.json({ error: "templates array is required" }, { status: 400 });
  }

  // Use lesson's title as fallback topic
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
    // Resolve templates
    const templateIds = templates.map((t) => t.templateId);
    const templateEntities = await ds.getRepository(ExerciseTemplate).find({
      where: templateIds.map((tid) => ({ id: tid, academyId: academy.id })),
    });
    const templateMap = new Map(templateEntities.map((t) => [t.id, t]));

    const requests = templates
      .filter((t) => t.count > 0 && templateMap.has(t.templateId))
      .map((t) => ({
        templateSlug: templateMap.get(t.templateId)!.slug,
        promptTemplate: templateMap.get(t.templateId)!.promptTemplate,
        count: t.count,
      }));

    if (requests.length === 0) {
      return NextResponse.json(
        { error: "No valid templates with count > 0" },
        { status: 400 }
      );
    }

    const { generateExercisesFromTemplates } = await import("@langopia/ai-pipeline");

    const result = await generateExercisesFromTemplates({
      requests,
      language: lesson.language,
      cefrLevel: lesson.cefrLevel,
      topic: effectiveTopic,
      sourceContent,
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
      const matchedTemplate = templateEntities.find((t) => t.slug === ex.templateSlug);

      const exercise = new Exercise();
      exercise.academyId = academy.id;
      exercise.templateId = matchedTemplate?.id ?? null;
      exercise.type = ex.templateSlug;
      exercise.targetSkill = ex.targetSkill || matchedTemplate?.targetSkill || "vocabulary";
      exercise.topic = effectiveTopic;
      exercise.language = lesson.language;
      exercise.instruction = ex.instruction;
      exercise.content = ex.content;
      exercise.options = ex.options ?? null;
      exercise.correctAnswer = ex.correctAnswer;
      exercise.explanation = ex.explanation;
      exercise.cefrLevel = lesson.cefrLevel;
      exercise.source = ExerciseSource.AI_LIVE;

      const savedExercise = await ds.getRepository(Exercise).save(exercise);

      // Link to lesson
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

    // Generate TTS audio
    if (process.env.ELEVENLABS_API_KEY) {
      const { generateExerciseAudio } = await import("@/lib/tts");
      for (const exercise of generated) {
        try {
          const audioText = `${exercise.instruction}. ${exercise.content}`;
          exercise.audioUrl = await generateExerciseAudio(audioText, exercise.id);
          await ds.getRepository(Exercise).save(exercise);
        } catch (audioErr) {
          console.error(`TTS failed for exercise ${exercise.id}:`, audioErr);
        }
      }
    }

    return NextResponse.json(
      {
        generated: generated.map((e) => ({
          id: e.id,
          type: e.type,
          targetSkill: e.targetSkill,
          topic: e.topic,
          language: e.language,
          instruction: e.instruction,
          content: e.content,
          options: e.options,
          cefrLevel: e.cefrLevel,
          source: e.source,
          templateId: e.templateId,
          audioUrl: e.audioUrl,
          createdAt: e.createdAt,
        })),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Failed to generate lesson exercises:", err);
    return NextResponse.json({ error: "Failed to generate exercises" }, { status: 500 });
  }
}

// DELETE /api/v1/lessons/:id/exercises - Unlink an exercise from lesson
// Usage: DELETE /api/v1/lessons/:id/exercises?exerciseId=xxx
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
