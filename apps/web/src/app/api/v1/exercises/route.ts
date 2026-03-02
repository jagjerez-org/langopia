import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Exercise, ExerciseTemplate, User } from "@/entities";
import { authenticateApiKey, checkPlanLimit, incrementUsage } from "@/lib/api-auth";
import { ExerciseSource, ExerciseType, TargetSkill, UsageMetric, UserPlan } from "@langopia/shared/types";

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
    data: exercises.map((e) => ({
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

  // Support both JSON and multipart/form-data
  let topic: string | undefined;
  let language: string | undefined;
  let cefrLevel: string | undefined;
  let sourceContent: string | undefined;
  // New template-based params
  let templates: { templateId: string; count: number }[] | undefined;
  // Legacy params
  let targetSkill: string | undefined;
  let count: number | undefined;

  const contentType = req.headers.get("content-type") ?? "";

  const MAX_FILE_SIZE = 10 * 1024 * 1024;  // 10 MB per file
  const MAX_TOTAL_SIZE = 30 * 1024 * 1024; // 30 MB total

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    topic = formData.get("topic") as string | undefined;
    language = (formData.get("language") as string) || "en";
    cefrLevel = formData.get("cefrLevel") as string | undefined;
    targetSkill = formData.get("targetSkill") as string | undefined;
    count = formData.get("count") ? Number(formData.get("count")) : undefined;

    const templatesJson = formData.get("templates") as string | null;
    if (templatesJson) {
      try { templates = JSON.parse(templatesJson); } catch { /* ignore */ }
    }

    // Handle multiple file attachments
    const files = formData.getAll("file") as File[];
    if (files.length > 0) {
      let totalSize = 0;
      const validFiles: File[] = [];

      for (const file of files) {
        if (!file || file.size === 0) continue;
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { error: `File "${file.name}" exceeds the 10 MB per-file limit (${(file.size / 1024 / 1024).toFixed(1)} MB).` },
            { status: 400 }
          );
        }
        totalSize += file.size;
        if (totalSize > MAX_TOTAL_SIZE) {
          return NextResponse.json(
            { error: `Total file size exceeds the 30 MB limit.` },
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
    language = body.language || "en";
    cefrLevel = body.cefrLevel;
    templates = body.templates;
    targetSkill = body.targetSkill;
    count = body.count;
  }

  if (!topic) {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
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

  try {
    // ── New template-based generation ──
    if (templates && templates.length > 0) {
      const templateIds = templates.map((t) => t.templateId);
      const templateEntities = await ds.getRepository(ExerciseTemplate).find({
        where: templateIds.map((id) => ({ id, academyId: academy.id })),
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
        language: language || "en",
        cefrLevel: cefrLevel || "B1",
        topic,
        sourceContent,
      });

      const saved: Exercise[] = [];
      for (const ex of result.exercises) {
        const matchedTemplate = templateEntities.find(
          (t) => t.slug === ex.templateSlug
        );
        const exercise = new Exercise();
        exercise.academyId = academy.id;
        exercise.templateId = matchedTemplate?.id ?? null;
        exercise.type = ex.templateSlug;
        exercise.targetSkill = ex.targetSkill || matchedTemplate?.targetSkill || "vocabulary";
        exercise.topic = topic;
        exercise.language = language || "en";
        exercise.instruction = ex.instruction;
        exercise.content = ex.content;
        exercise.options = ex.options ?? null;
        exercise.correctAnswer = ex.correctAnswer;
        exercise.explanation = ex.explanation;
        exercise.cefrLevel = cefrLevel || "B1";
        exercise.source = ExerciseSource.AI_LIVE;
        saved.push(await ds.getRepository(Exercise).save(exercise));
      }

      if (result.tokensUsed > 0) {
        await incrementUsage(ownerId, academy.id, UsageMetric.AI_TOKENS, result.tokensUsed);
      }

      // Generate TTS audio
      if (process.env.ELEVENLABS_API_KEY) {
        const { generateExerciseAudio } = await import("@/lib/tts");
        for (const exercise of saved) {
          try {
            const audioText = `${exercise.instruction}. ${exercise.content}`;
            exercise.audioUrl = await generateExerciseAudio(audioText, exercise.id);
            await ds.getRepository(Exercise).save(exercise);
          } catch (audioErr) {
            console.error(`TTS generation failed for exercise ${exercise.id}:`, audioErr);
          }
        }
      }

      return NextResponse.json(
        {
          data: saved.map((e) => ({
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
    }

    // ── Legacy generation (backward compat) ──
    if (!targetSkill || !cefrLevel) {
      return NextResponse.json(
        { error: "Either templates array or targetSkill + cefrLevel are required" },
        { status: 400 }
      );
    }

    const { generateExercises } = await import("@langopia/ai-pipeline");

    const result = await generateExercises({
      studentName: "Student",
      language: language || "en",
      cefrLevel,
      vocabularyBank: [],
      grammarPatterns: [],
      recentSuggestions: [
        `Focus on ${targetSkill} exercises about: ${topic}`,
      ],
      sourceContent,
    });

    const saved: Exercise[] = [];

    const validTypes = new Set(Object.values(ExerciseType));
    const validSkills = new Set(Object.values(TargetSkill));

    for (const ex of result.exercises) {
      const exercise = new Exercise();
      exercise.academyId = academy.id;
      exercise.templateId = null;
      exercise.type = validTypes.has(ex.type as ExerciseType)
        ? (ex.type as ExerciseType)
        : ExerciseType.MULTIPLE_CHOICE;
      exercise.targetSkill = validSkills.has(ex.targetSkill as TargetSkill)
        ? (ex.targetSkill as TargetSkill)
        : (targetSkill as TargetSkill);
      exercise.topic = topic;
      exercise.language = language || "en";
      exercise.instruction = ex.instruction;
      exercise.content = ex.content;
      exercise.options = ex.options ?? null;
      exercise.correctAnswer = ex.correctAnswer;
      exercise.explanation = ex.explanation;
      exercise.cefrLevel = cefrLevel;
      exercise.source = ExerciseSource.AI_LIVE;
      saved.push(await ds.getRepository(Exercise).save(exercise));
    }

    // Track AI token usage
    if (result.tokensUsed > 0) {
      await incrementUsage(ownerId, academy.id, UsageMetric.AI_TOKENS, result.tokensUsed);
    }

    // Generate TTS audio for each exercise
    if (process.env.ELEVENLABS_API_KEY) {
      const { generateExerciseAudio } = await import("@/lib/tts");
      for (const exercise of saved) {
        try {
          const audioText = `${exercise.instruction}. ${exercise.content}`;
          exercise.audioUrl = await generateExerciseAudio(audioText, exercise.id);
          await ds.getRepository(Exercise).save(exercise);
        } catch (audioErr) {
          console.error(`TTS generation failed for exercise ${exercise.id}:`, audioErr);
        }
      }
    }

    return NextResponse.json(
      {
        data: saved.map((e) => ({
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
          audioUrl: e.audioUrl,
          createdAt: e.createdAt,
        })),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Failed to generate exercises:", err);
    return NextResponse.json({ error: "Failed to generate exercises" }, { status: 500 });
  }
}
