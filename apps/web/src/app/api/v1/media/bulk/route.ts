import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDataSource } from "@/lib/database";
import { MediaItem, User } from "@/entities";
import { authenticateApiKey, checkPlanLimit, incrementUsage } from "@/lib/api-auth";
import { UsageMetric, UserPlan } from "@langopia/shared/types";
import { uploadToS3 } from "@/lib/s3";
import { analyzeMediaItem } from "@/lib/media-processing";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 20;
const VALID_CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

// POST /api/v1/media/bulk — Upload multiple files
export async function POST(req: NextRequest) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;
  const { academy, ownerId } = authResult;

  const ds = await getDataSource();
  const user = await ds.getRepository(User).findOne({ where: { id: ownerId } });
  const plan = (user?.plan as UserPlan) ?? UserPlan.FREE;
  const storageCheck = await checkPlanLimit(ownerId, plan, UsageMetric.STORAGE_BYTES);
  if (!storageCheck.allowed) {
    return NextResponse.json(
      { error: "Storage limit exceeded. Please upgrade your plan." },
      { status: 403 }
    );
  }

  const formData = await req.formData();
  const cefrLevel = (formData.get("cefrLevel") as string | null)?.trim().toUpperCase() ?? "";
  if (!cefrLevel || !VALID_CEFR_LEVELS.includes(cefrLevel)) {
    return NextResponse.json(
      { error: `cefrLevel is required. Valid values: ${VALID_CEFR_LEVELS.join(", ")}` },
      { status: 400 }
    );
  }

  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Maximum ${MAX_FILES} files per request` }, { status: 400 });
  }

  const repo = ds.getRepository(MediaItem);
  const results: { mediaItem: MediaItem; duplicate: boolean }[] = [];

  for (const file of files) {
    if (!file || file.size === 0) continue;
    if (file.size > MAX_FILE_SIZE) {
      results.push({
        mediaItem: { filename: file.name, status: "failed" } as MediaItem,
        duplicate: false,
      });
      continue;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");

    // Check duplicate
    const existing = await repo.findOne({
      where: { academyId: academy.id, contentHash },
    });
    if (existing) {
      results.push({ mediaItem: existing, duplicate: true });
      continue;
    }

    // Upload to S3
    const ext = file.name.split(".").pop() ?? "bin";
    const storageKey = `media/${academy.id}/${crypto.randomUUID()}.${ext}`;
    const storageUrl = await uploadToS3(storageKey, buffer, file.type || "application/octet-stream");

    // Create record
    const item = new MediaItem();
    item.academyId = academy.id;
    item.uploadedByUserId = ownerId;
    item.filename = file.name;
    item.mimeType = file.type || "application/octet-stream";
    item.fileSize = file.size;
    item.contentHash = contentHash;
    item.storageKey = storageKey;
    item.storageUrl = storageUrl;
    item.status = "pending";
    item.detectedCefrLevel = cefrLevel;

    const saved = await repo.save(item);

    await incrementUsage(ownerId, academy.id, UsageMetric.STORAGE_BYTES, file.size);

    // Fire-and-forget
    analyzeMediaItem(saved.id).catch((err) =>
      console.error("Background media analysis failed:", err)
    );

    results.push({ mediaItem: saved, duplicate: false });
  }

  return NextResponse.json({ data: results }, { status: 201 });
}
