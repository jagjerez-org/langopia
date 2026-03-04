import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDataSource } from "@/lib/database";
import { MediaItem, User } from "@/entities";
import { authenticateApiKey, checkPlanLimit, incrementUsage } from "@/lib/api-auth";
import { UsageMetric, UserPlan } from "@langopia/shared/types";
import { uploadToS3 } from "@/lib/s3";
import { analyzeMediaItem } from "@/lib/media-processing";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const VALID_CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

// POST /api/v1/media — Upload single file
export async function POST(req: NextRequest) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;
  const { academy, ownerId } = authResult;

  // Check storage limit
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
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File exceeds 50 MB limit" }, { status: 400 });
  }

  const cefrLevel = (formData.get("cefrLevel") as string | null)?.trim().toUpperCase() ?? "";
  if (!cefrLevel || !VALID_CEFR_LEVELS.includes(cefrLevel)) {
    return NextResponse.json(
      { error: `cefrLevel is required. Valid values: ${VALID_CEFR_LEVELS.join(", ")}` },
      { status: 400 }
    );
  }

  const tagsRaw = formData.get("tags") as string | null;
  const tags: string[] = tagsRaw ? JSON.parse(tagsRaw) : [];

  const buffer = Buffer.from(await file.arrayBuffer());

  // Compute SHA-256 hash
  const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");

  // Check for duplicate
  const repo = ds.getRepository(MediaItem);
  const existing = await repo.findOne({
    where: { academyId: academy.id, contentHash },
  });
  if (existing) {
    return NextResponse.json({ data: existing, duplicate: true });
  }

  // Upload to MinIO
  const ext = file.name.split(".").pop() ?? "bin";
  const storageKey = `media/${academy.id}/${crypto.randomUUID()}.${ext}`;
  const storageUrl = await uploadToS3(storageKey, buffer, file.type || "application/octet-stream");

  // Create MediaItem
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
  item.tags = tags;

  const saved = await repo.save(item);

  // Track storage usage
  await incrementUsage(ownerId, academy.id, UsageMetric.STORAGE_BYTES, file.size);

  // Fire-and-forget analysis
  analyzeMediaItem(saved.id).catch((err) =>
    console.error("Background media analysis failed:", err)
  );

  return NextResponse.json({ data: saved, duplicate: false }, { status: 201 });
}

// GET /api/v1/media — List media items
export async function GET(req: NextRequest) {
  const authResult = await authenticateApiKey(req);
  if (authResult instanceof NextResponse) return authResult;
  const { academy } = authResult;

  const url = req.nextUrl;
  const search = url.searchParams.get("search") ?? "";
  const mimeType = url.searchParams.get("mimeType") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const tagsParam = url.searchParams.get("tags") ?? "";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const ds = await getDataSource();
  const qb = ds
    .getRepository(MediaItem)
    .createQueryBuilder("m")
    .where("m.academyId = :academyId", { academyId: academy.id })
    .orderBy("m.createdAt", "DESC")
    .skip(offset)
    .take(limit);

  if (mimeType) {
    qb.andWhere("m.mimeType = :mimeType", { mimeType });
  }
  if (status) {
    qb.andWhere("m.status = :status", { status });
  }
  if (tagsParam) {
    const tags = tagsParam.split(",").map((t) => t.trim());
    qb.andWhere("m.tags @> :tags", { tags: JSON.stringify(tags) });
  }
  if (search) {
    qb.andWhere(
      "(m.filename ILIKE :search OR m.detectedTopic ILIKE :search)",
      { search: `%${search}%` }
    );
  }

  const [data, total] = await qb.getManyAndCount();

  return NextResponse.json({ data, total, limit, offset });
}
