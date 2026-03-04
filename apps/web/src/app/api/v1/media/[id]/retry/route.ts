import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/database";
import { MediaItem, MediaPage } from "@/entities";
import { authenticateApiKey } from "@/lib/api-auth";
import { analyzeMediaItem } from "@/lib/media-processing";

// POST /api/v1/media/[id]/retry — Retry failed analysis
export async function POST(
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

  if (item.status !== "failed") {
    return NextResponse.json(
      { error: "Only failed items can be retried" },
      { status: 400 }
    );
  }

  // Delete existing pages
  await ds.getRepository(MediaPage).delete({ mediaItemId: id });

  // Reset
  await repo.update(id, {
    status: "pending",
    processedPages: 0,
    totalPages: 0,
  });

  // Fire-and-forget
  analyzeMediaItem(id).catch((err) =>
    console.error("Retry media analysis failed:", err)
  );

  const updated = await repo.findOne({ where: { id } });
  return NextResponse.json({ data: updated });
}
