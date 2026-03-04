import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { MediaItem, MediaPage } from "@/entities";
import { authenticateApiKey, incrementUsage } from "@/lib/api-auth";
import { UsageMetric } from "@langopia/shared/types";
import { deleteFromS3 } from "@/lib/s3";
import { generateEmbedding } from "@/lib/embeddings";
import pgvector from "pgvector";

// GET /api/v1/media/[id] — Get media item with pages
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;
  const { academy } = authResult;
  const { id } = await params;

  const ds = await getDataSource();
  const item = await ds.getRepository(MediaItem).findOne({
    where: { id, academyId: academy.id },
    relations: ["pages"],
    order: { pages: { pageNumber: "ASC" } },
  });

  if (!item) {
    return NextResponse.json({ error: "Media item not found" }, { status: 404 });
  }

  return NextResponse.json({ data: item });
}

// PATCH /api/v1/media/[id] — Edit metadata
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;
  const { academy } = authResult;
  const { id } = await params;

  const ds = await getDataSource();
  const repo = ds.getRepository(MediaItem);
  const item = await repo.findOne({ where: { id, academyId: academy.id } });

  if (!item) {
    return NextResponse.json({ error: "Media item not found" }, { status: 404 });
  }

  const body = await req.json();
  const { tags, detectedTopic, detectedCefrLevel, detectedLanguage } = body;

  const topicChanged = detectedTopic !== undefined && detectedTopic !== item.detectedTopic;

  if (tags !== undefined) item.tags = tags;
  if (detectedTopic !== undefined) item.detectedTopic = detectedTopic;
  if (detectedCefrLevel !== undefined) item.detectedCefrLevel = detectedCefrLevel;
  if (detectedLanguage !== undefined) item.detectedLanguage = detectedLanguage;

  const updated = await repo.save(item);

  // Re-embed if topic changed
  if (topicChanged && item.summary) {
    const embeddingText = `[${item.detectedLanguage}] [${item.detectedCefrLevel}] Topic: ${item.detectedTopic}\n${item.summary}`;
    generateEmbedding(embeddingText)
      .then(({ embedding }) =>
        repo
          .createQueryBuilder()
          .update()
          .set({ embedding: pgvector.toSql(embedding) as unknown as string })
          .where("id = :id", { id })
          .execute()
      )
      .catch((err) => console.warn("Re-embed failed:", err));
  }

  return NextResponse.json({ data: updated });
}

// DELETE /api/v1/media/[id] — Delete media item
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;
  const { academy, ownerId } = authResult;
  const { id } = await params;

  const ds = await getDataSource();
  const repo = ds.getRepository(MediaItem);
  const item = await repo.findOne({ where: { id, academyId: academy.id } });

  if (!item) {
    return NextResponse.json({ error: "Media item not found" }, { status: 404 });
  }

  // Delete from S3
  try {
    await deleteFromS3(item.storageKey);
  } catch (err) {
    console.warn("Failed to delete from S3:", err);
  }

  // Delete from DB (CASCADE removes pages)
  await repo.remove(item);

  // Decrement storage usage (negative increment)
  await incrementUsage(ownerId, academy.id, UsageMetric.STORAGE_BYTES, -item.fileSize);

  return NextResponse.json({ deleted: true });
}
