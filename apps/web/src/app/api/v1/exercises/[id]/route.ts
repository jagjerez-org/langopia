import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Exercise, User } from "@/entities";
import { authenticateApiKey, checkPlanLimit, incrementUsage } from "@/lib/api-auth";
import { ExerciseSource, EXERCISE_TYPE_CONFIG, ExerciseType, UsageMetric, UserPlan } from "@langopia/shared/types";

type Params = { params: Promise<{ id: string }> };

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

// GET /api/v1/exercises/:id - Get exercise details
export async function GET(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  const exercise = await ds.getRepository(Exercise).findOne({
    where: { id, academyId: academy.id },
  });

  if (!exercise) {
    return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
  }

  return NextResponse.json(serializeExercise(exercise));
}

// DELETE /api/v1/exercises/:id - Delete exercise
export async function DELETE(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  const exercise = await ds.getRepository(Exercise).findOne({
    where: { id, academyId: academy.id },
  });

  if (!exercise) {
    return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
  }

  await ds.getRepository(Exercise).remove(exercise);

  return NextResponse.json({ deleted: true });
}

// PATCH /api/v1/exercises/:id - Edit exercise fields
export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy, ownerId } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  const exercise = await ds.getRepository(Exercise).findOne({
    where: { id, academyId: academy.id },
  });

  if (!exercise) {
    return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
  }

  const body = await req.json();

  const editableFields = ["title", "instruction", "content", "options", "correctAnswer", "explanation", "cefrLevel", "targetSkill", "topic", "videoUrl", "imageUrl"] as const;
  const isContentEdit = editableFields.some((f) => body[f] !== undefined);

  if (isContentEdit) {
    if (body.title !== undefined) exercise.title = body.title;
    if (body.instruction !== undefined) exercise.instruction = body.instruction;
    if (body.content !== undefined) exercise.content = body.content;
    if (body.options !== undefined) exercise.options = body.options;
    if (body.correctAnswer !== undefined) exercise.correctAnswer = body.correctAnswer;
    if (body.explanation !== undefined) exercise.explanation = body.explanation;
    if (body.cefrLevel !== undefined) exercise.cefrLevel = body.cefrLevel;
    if (body.targetSkill !== undefined) exercise.targetSkill = body.targetSkill;
    if (body.topic !== undefined) exercise.topic = body.topic;
    if (body.videoUrl !== undefined) exercise.videoUrl = body.videoUrl;
    if (body.imageUrl !== undefined) exercise.imageUrl = body.imageUrl;

    await ds.getRepository(Exercise).save(exercise);

    // Re-embed if semantic fields changed
    const embeddingFields = ["title", "instruction", "content", "topic", "targetSkill", "cefrLevel"] as const;
    if (embeddingFields.some((f) => body[f] !== undefined)) {
      import("@/lib/embeddings").then(({ embedExercise }) => {
        embedExercise(exercise.id)
          .then((tokens) => { if (tokens > 0) incrementUsage(ownerId, academy.id, UsageMetric.AI_TOKENS, tokens); })
          .catch((err) => console.error("Embedding re-generation failed:", err));
      });
    }

    return NextResponse.json(serializeExercise(exercise));
  }

  return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
}

// PUT /api/v1/exercises/:id - Regenerate exercise with optional custom prompt
export async function PUT(req: NextRequest, { params }: Params) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy, ownerId } = authResult;
  const { id } = await params;
  const ds = await getDataSource();

  const existing = await ds.getRepository(Exercise).findOne({
    where: { id, academyId: academy.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
  }

  // Parse optional body
  let customPrompt: string | undefined;
  try {
    const body = await req.json();
    if (body.customPrompt && typeof body.customPrompt === "string") {
      customPrompt = body.customPrompt.trim();
    }
  } catch {
    // No body or invalid JSON — that's fine
  }

  try {
    const { generateExercisesByType } = await import("@langopia/ai-pipeline");

    const result = await generateExercisesByType({
      requests: [{ type: existing.type, count: 1 }],
      language: existing.language,
      cefrLevel: existing.cefrLevel,
      topic: existing.topic ?? "general",
      customPrompt,
    });

    if (result.exercises.length === 0) {
      return NextResponse.json({ error: "AI failed to generate exercise" }, { status: 500 });
    }

    const generatedEx = result.exercises[0];

    // Track AI token usage
    if (result.tokensUsed > 0) {
      await incrementUsage(ownerId, academy.id, UsageMetric.AI_TOKENS, result.tokensUsed);
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

    const saved = await ds.getRepository(Exercise).save(existing);

    // Generate TTS audio
    const config = EXERCISE_TYPE_CONFIG[saved.type as ExerciseType];
    const AUDIO_KEYWORDS = /\b(listen|audio|dictation|pronunciat|spoken|oral|dialogue|hear)\b/i;
    const needsAudio = config?.needsAudio ||
      generatedEx.needsAudio ||
      AUDIO_KEYWORDS.test(saved.type) ||
      AUDIO_KEYWORDS.test(saved.targetSkill) ||
      AUDIO_KEYWORDS.test(saved.instruction);

    if (needsAudio) {
      const { isTTSAvailable, generateExerciseAudio } = await import("@/lib/tts");
      if (isTTSAvailable()) {
        const user = await ds.getRepository(User).findOne({ where: { id: ownerId } });
        const ttsLimit = await checkPlanLimit(ownerId, (user?.plan as UserPlan) ?? UserPlan.FREE, UsageMetric.TTS_CHARACTERS);
        if (ttsLimit.allowed) {
          try {
            const audioText = saved.content;
            saved.audioUrl = await generateExerciseAudio(audioText, saved.id, saved.language);
            await ds.getRepository(Exercise).save(saved);
            await incrementUsage(ownerId, academy.id, UsageMetric.TTS_CHARACTERS, audioText.length);
          } catch (audioErr) {
            console.error(`TTS generation failed for exercise ${saved.id}:`, audioErr);
          }
        }
      }
    }

    // Fire-and-forget: generate embedding
    import("@/lib/embeddings").then(({ embedExercise }) => {
      embedExercise(saved.id)
        .then((tokens) => { if (tokens > 0) incrementUsage(ownerId, academy.id, UsageMetric.AI_TOKENS, tokens); })
        .catch((err) => console.error("Embedding generation failed:", err));
    });

    return NextResponse.json(serializeExercise(saved));
  } catch (err) {
    console.error("Failed to regenerate exercise:", err);
    return NextResponse.json({ error: "Failed to regenerate exercise" }, { status: 500 });
  }
}
