import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { User } from "@/entities";
import { authenticateApiKey, checkPlanLimit, incrementUsage } from "@/lib/api-auth";
import { UsageMetric, UserPlan } from "@langopia/shared/types";
import { findDedupCandidates, DISTANCE_THRESHOLD_DEDUP, DISTANCE_THRESHOLD_TOPIC } from "@/lib/embeddings";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_SIZE = 30 * 1024 * 1024;

// POST /api/v1/exercises/analyze - Analyze material and suggest exercise plan
export async function POST(req: NextRequest) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { ownerId } = authResult;

  // Check AI token plan limit
  const ds = await getDataSource();
  const user = await ds.getRepository(User).findOne({ where: { id: ownerId } });
  const plan = (user?.plan as UserPlan) ?? UserPlan.FREE;
  const limitCheck = await checkPlanLimit(ownerId, plan, UsageMetric.AI_TOKENS);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { error: "AI token limit exceeded. Please upgrade your plan." },
      { status: 403 }
    );
  }

  let topic: string | undefined;
  let language = "en";
  let cefrLevel = "B1";
  let sourceContent: string | undefined;

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    topic = (formData.get("topic") as string) || undefined;
    language = (formData.get("language") as string) || "en";
    cefrLevel = (formData.get("cefrLevel") as string) || "B1";

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
    language = body.language || "en";
    cefrLevel = body.cefrLevel || "B1";
    sourceContent = body.materialContext;
  }

  if (!topic && !sourceContent) {
    return NextResponse.json(
      { error: "Either topic or file upload is required" },
      { status: 400 }
    );
  }

  try {
    const { analyzeExerciseMaterial } = await import("@langopia/ai-pipeline");

    const result = await analyzeExerciseMaterial({
      materialText: sourceContent,
      topic,
      language,
      cefrLevel,
    });

    // Track AI token usage
    if (result.tokensUsed > 0) {
      await incrementUsage(ownerId, authResult.academy.id, UsageMetric.AI_TOKENS, result.tokensUsed);
    }

    // Find existing similar exercises via embeddings
    let existingExercises: unknown[] = [];
    try {
      const effectiveTopic = result.detectedTopic || topic || "";
      if (effectiveTopic) {
        const { candidates, tokensUsed: dedupTokens } = await findDedupCandidates({
          topic: effectiveTopic,
          materialContext: sourceContent,
          academyId: authResult.academy.id,
          language,
          cefrLevel,
        });
        if (dedupTokens > 0) {
          await incrementUsage(ownerId, authResult.academy.id, UsageMetric.AI_TOKENS, dedupTokens);
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
          similarity: e.distance < DISTANCE_THRESHOLD_DEDUP
            ? "very_high"
            : e.distance < DISTANCE_THRESHOLD_TOPIC
              ? "high"
              : "medium",
        }));
      }
    } catch (embedErr) {
      console.warn("Embedding search failed (continuing without existing exercises):", embedErr);
    }

    return NextResponse.json({
      detectedTopic: result.detectedTopic,
      materialSummary: result.materialSummary,
      suggestions: result.suggestions,
      existingExercises,
    });
  } catch (err) {
    console.error("Failed to analyze material:", err);
    return NextResponse.json(
      { error: "Failed to analyze material" },
      { status: 500 }
    );
  }
}
