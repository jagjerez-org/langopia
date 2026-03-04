import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, incrementUsage } from "@/lib/api-auth";
import { UsageMetric } from "@langopia/shared/types";
import { findSimilarExercises } from "@/lib/embeddings";

// POST /api/v1/exercises/search - Semantic search for exercises
export async function POST(req: NextRequest) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

  const { academy, ownerId } = authResult;

  const body = await req.json();
  const { query, limit = 10, language, cefrLevel, targetSkill, excludeIds, mode, distanceThreshold } = body as {
    query: string;
    limit?: number;
    language?: string;
    cefrLevel?: string;
    targetSkill?: string;
    excludeIds?: string[];
    mode?: "topic" | "content";
    distanceThreshold?: number;
  };

  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "query string is required" }, { status: 400 });
  }

  try {
    const { exercises, tokensUsed } = await findSimilarExercises({
      query,
      academyId: academy.id,
      limit: Math.min(limit, 50),
      language,
      cefrLevel,
      targetSkill,
      excludeIds,
      mode,
      distanceThreshold,
    });

    if (tokensUsed > 0) {
      await incrementUsage(ownerId, academy.id, UsageMetric.AI_TOKENS, tokensUsed);
    }

    return NextResponse.json({
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
    });
  } catch (err) {
    console.error("Semantic search failed:", err);
    return NextResponse.json({ error: "Semantic search failed" }, { status: 500 });
  }
}
