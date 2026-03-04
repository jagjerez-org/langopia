import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { User } from "@/entities";
import { authenticateApiKey, checkPlanLimit, incrementUsage } from "@/lib/api-auth";
import { UsageMetric, UserPlan } from "@langopia/shared/types";
import { findSimilarMedia } from "@/lib/media-processing";

// POST /api/v1/media/search — Semantic search
export async function POST(req: NextRequest) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;
  const { academy, ownerId } = authResult;

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

  const body = await req.json();
  const { query, limit, mimeType, tags } = body;

  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const result = await findSimilarMedia({
    query,
    academyId: academy.id,
    limit: limit ?? 10,
    mimeType,
    tags,
  });

  // Track AI token usage
  if (result.tokensUsed > 0) {
    await incrementUsage(ownerId, academy.id, UsageMetric.AI_TOKENS, result.tokensUsed);
  }

  return NextResponse.json({
    data: result.items,
    total: result.items.length,
    tokensUsed: result.tokensUsed,
  });
}
