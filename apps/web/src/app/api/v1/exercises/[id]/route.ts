import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { Exercise } from "@/entities";
import { authenticateApiKey, incrementUsage } from "@/lib/api-auth";
import { ExerciseSource, UsageMetric } from "@langopia/shared/types";

type Params = { params: Promise<{ id: string }> };

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

  return NextResponse.json({
    id: exercise.id,
    type: exercise.type,
    targetSkill: exercise.targetSkill,
    topic: exercise.topic,
    language: exercise.language,
    instruction: exercise.instruction,
    content: exercise.content,
    options: exercise.options,
    correctAnswer: exercise.correctAnswer,
    explanation: exercise.explanation,
    cefrLevel: exercise.cefrLevel,
    source: exercise.source,
    templateId: exercise.templateId,
    audioUrl: exercise.audioUrl,
    createdAt: exercise.createdAt,
  });
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

// PATCH /api/v1/exercises/:id - Submit answer for exercise
export async function PATCH(req: NextRequest, { params }: Params) {
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

  const body = await req.json();

  // ── Content editing (instruction, content, options, etc.) ──
  const editableFields = ["instruction", "content", "options", "correctAnswer", "explanation", "cefrLevel", "targetSkill", "topic"] as const;
  const isContentEdit = editableFields.some((f) => body[f] !== undefined);

  if (isContentEdit) {
    if (body.instruction !== undefined) exercise.instruction = body.instruction;
    if (body.content !== undefined) exercise.content = body.content;
    if (body.options !== undefined) exercise.options = body.options;
    if (body.correctAnswer !== undefined) exercise.correctAnswer = body.correctAnswer;
    if (body.explanation !== undefined) exercise.explanation = body.explanation;
    if (body.cefrLevel !== undefined) exercise.cefrLevel = body.cefrLevel;
    if (body.targetSkill !== undefined) exercise.targetSkill = body.targetSkill;
    if (body.topic !== undefined) exercise.topic = body.topic;

    await ds.getRepository(Exercise).save(exercise);

    return NextResponse.json({
      id: exercise.id,
      type: exercise.type,
      targetSkill: exercise.targetSkill,
      topic: exercise.topic,
      language: exercise.language,
      instruction: exercise.instruction,
      content: exercise.content,
      options: exercise.options,
      correctAnswer: exercise.correctAnswer,
      explanation: exercise.explanation,
      cefrLevel: exercise.cefrLevel,
      source: exercise.source,
      templateId: exercise.templateId,
      audioUrl: exercise.audioUrl,
      createdAt: exercise.createdAt,
    });
  }

  return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
}

// PUT /api/v1/exercises/:id - Regenerate exercise (delete old, create new)
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

  const { type: originalType, topic, targetSkill, cefrLevel, language: originalLanguage } = existing;

  try {
    const { generateExercises } = await import("@langopia/ai-pipeline");

    const result = await generateExercises({
      studentName: "Student",
      language: "en",
      cefrLevel,
      vocabularyBank: [],
      grammarPatterns: [],
      recentSuggestions: [
        `Generate a ${originalType.replace(/_/g, " ")} exercise about ${targetSkill}: ${topic ?? "general"}`,
      ],
    });

    if (!result.exercises.length) {
      return NextResponse.json({ error: "AI failed to generate exercise" }, { status: 500 });
    }

    // Track AI token usage
    if (result.tokensUsed > 0) {
      await incrementUsage(ownerId, academy.id, UsageMetric.AI_TOKENS, result.tokensUsed);
    }

    // Delete old exercise
    await ds.getRepository(Exercise).remove(existing);

    // Save new exercise — preserve the original type and targetSkill
    const ex = result.exercises[0];

    const exercise = new Exercise();
    exercise.academyId = academy.id;
    exercise.type = originalType;
    exercise.targetSkill = targetSkill;
    exercise.topic = topic;
    exercise.instruction = ex.instruction;
    exercise.content = ex.content;
    exercise.options = ex.options ?? null;
    exercise.correctAnswer = ex.correctAnswer;
    exercise.explanation = ex.explanation;
    exercise.language = originalLanguage;
    exercise.cefrLevel = cefrLevel;
    exercise.source = ExerciseSource.AI_LIVE;

    const saved = await ds.getRepository(Exercise).save(exercise);

    // Generate TTS audio
    if (process.env.ELEVENLABS_API_KEY) {
      try {
        const { generateExerciseAudio } = await import("@/lib/tts");
        const audioText = `${saved.instruction}. ${saved.content}`;
        saved.audioUrl = await generateExerciseAudio(audioText, saved.id);
        await ds.getRepository(Exercise).save(saved);
      } catch (audioErr) {
        console.error(`TTS generation failed for exercise ${saved.id}:`, audioErr);
      }
    }

    return NextResponse.json({
      id: saved.id,
      type: saved.type,
      targetSkill: saved.targetSkill,
      topic: saved.topic,
      language: saved.language,
      instruction: saved.instruction,
      content: saved.content,
      options: saved.options,
      correctAnswer: saved.correctAnswer,
      explanation: saved.explanation,
      cefrLevel: saved.cefrLevel,
      source: saved.source,
      templateId: saved.templateId,
      audioUrl: saved.audioUrl,
      createdAt: saved.createdAt,
    });
  } catch (err) {
    console.error("Failed to regenerate exercise:", err);
    return NextResponse.json({ error: "Failed to regenerate exercise" }, { status: 500 });
  }
}
