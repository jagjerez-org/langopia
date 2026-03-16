import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import crypto from "crypto";
import pgvector from "pgvector";
import { UsageMetric, UserPlan } from "@langopia/shared/types";
import { MediaItem } from "../database/entities/media-item.entity.js";
import { MediaPage } from "../database/entities/media-page.entity.js";
import { User } from "../database/entities/user.entity.js";
import { UsageService } from "../usage/usage.service.js";
import { StorageService } from "../storage/storage.service.js";
import { EmbeddingService } from "../embedding/embedding.service.js";
import { MediaProcessingService } from "../media-processing/media-processing.service.js";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES = 20;
const VALID_CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @InjectRepository(MediaItem)
    private readonly mediaRepo: Repository<MediaItem>,
    @InjectRepository(MediaPage)
    private readonly pageRepo: Repository<MediaPage>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly usage: UsageService,
    private readonly storage: StorageService,
    private readonly embedding: EmbeddingService,
    private readonly mediaProcessing: MediaProcessingService,
  ) {}

  private async withPreviewUrl(item: MediaItem): Promise<MediaItem & { previewUrl: string }> {
    const previewUrl = await this.storage.getPresignedUrl(item.storageKey);
    return Object.assign(item, { previewUrl });
  }

  // POST /v1/media — Upload single file
  async uploadSingle(
    academyId: string,
    ownerId: string,
    file: Express.Multer.File,
    cefrLevel?: string,
    tagsRaw?: string,
  ) {
    // Check storage limit
    const user = await this.userRepo.findOne({ where: { id: ownerId } });
    const plan = (user?.plan as UserPlan) ?? UserPlan.FREE;
    const storageCheck = await this.usage.checkPlanLimit(
      ownerId,
      plan,
      UsageMetric.STORAGE_BYTES,
    );
    if (!storageCheck.allowed) {
      throw new ForbiddenException(
        "Storage limit exceeded. Please upgrade your plan.",
      );
    }

    if (!file || file.size === 0) {
      throw new BadRequestException("No file provided");
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException("File exceeds 50 MB limit");
    }

    const normalizedCefr = cefrLevel?.trim().toUpperCase() ?? "";
    const validCefr = normalizedCefr && VALID_CEFR_LEVELS.includes(normalizedCefr) ? normalizedCefr : null;

    const tags: string[] = tagsRaw ? JSON.parse(tagsRaw) : [];

    const buffer = file.buffer;

    // Compute SHA-256 hash
    const contentHash = crypto
      .createHash("sha256")
      .update(buffer)
      .digest("hex");

    // Check for duplicate
    const existing = await this.mediaRepo.findOne({
      where: { academyId, contentHash },
    });
    if (existing) {
      return { data: await this.withPreviewUrl(existing), duplicate: true };
    }

    // Upload to MinIO
    const ext = file.originalname.split(".").pop() ?? "bin";
    const storageKey = `media/${academyId}/${crypto.randomUUID()}.${ext}`;
    const storageUrl = await this.storage.uploadToS3(
      storageKey,
      buffer,
      file.mimetype || "application/octet-stream",
    );

    // Create MediaItem
    const item = new MediaItem();
    item.academyId = academyId;
    item.uploadedByUserId = ownerId;
    item.filename = file.originalname;
    item.mimeType = file.mimetype || "application/octet-stream";
    item.fileSize = file.size;
    item.contentHash = contentHash;
    item.storageKey = storageKey;
    item.storageUrl = storageUrl;
    item.status = "pending";
    item.detectedCefrLevel = validCefr;
    item.tags = tags;

    const saved = await this.mediaRepo.save(item);

    // Track storage usage
    await this.usage.incrementUsage(
      ownerId,
      academyId,
      UsageMetric.STORAGE_BYTES,
      file.size,
    );

    // Fire-and-forget analysis
    this.mediaProcessing
      .analyzeMediaItem(saved.id, ownerId, academyId)
      .catch((err) =>
        this.logger.error("Background media analysis failed:", err),
      );

    return { data: await this.withPreviewUrl(saved), duplicate: false };
  }

  // GET /v1/media — List media items
  async listMedia(
    academyId: string,
    opts: {
      search?: string;
      mimeType?: string;
      status?: string;
      tags?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const limit = Math.min(opts.limit ?? 50, 100);
    const offset = opts.offset ?? 0;

    const qb = this.mediaRepo
      .createQueryBuilder("m")
      .where("m.academyId = :academyId", { academyId })
      .orderBy("m.createdAt", "DESC")
      .skip(offset)
      .take(limit);

    if (opts.mimeType) {
      qb.andWhere("m.mimeType = :mimeType", {
        mimeType: opts.mimeType,
      });
    }
    if (opts.status) {
      qb.andWhere("m.status = :status", { status: opts.status });
    }
    if (opts.tags) {
      const tags = opts.tags.split(",").map((t) => t.trim());
      qb.andWhere("m.tags @> :tags", { tags: JSON.stringify(tags) });
    }
    if (opts.search) {
      qb.andWhere(
        "(m.filename ILIKE :search OR m.detectedTopic ILIKE :search)",
        { search: `%${opts.search}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    const data = await Promise.all(items.map((item) => this.withPreviewUrl(item)));

    return { data, total, limit, offset };
  }

  // GET /v1/media/:id — Get media item with pages
  async getMediaItem(id: string, academyId: string) {
    const item = await this.mediaRepo.findOne({
      where: { id, academyId },
      relations: ["pages", "chunks"],
      order: { pages: { pageNumber: "ASC" }, chunks: { orderIndex: "ASC" } },
    });

    if (!item) {
      throw new NotFoundException("Media item not found");
    }

    return { data: await this.withPreviewUrl(item) };
  }

  // PATCH /v1/media/:id — Edit metadata
  async updateMediaItem(
    id: string,
    academyId: string,
    body: {
      tags?: string[];
      detectedTopic?: string;
      detectedCefrLevel?: string;
      detectedLanguage?: string;
    },
  ) {
    const item = await this.mediaRepo.findOne({
      where: { id, academyId },
    });

    if (!item) {
      throw new NotFoundException("Media item not found");
    }

    const { tags, detectedTopic, detectedCefrLevel, detectedLanguage } =
      body;

    const topicChanged =
      detectedTopic !== undefined &&
      detectedTopic !== item.detectedTopic;

    if (tags !== undefined) item.tags = tags;
    if (detectedTopic !== undefined) item.detectedTopic = detectedTopic;
    if (detectedCefrLevel !== undefined)
      item.detectedCefrLevel = detectedCefrLevel;
    if (detectedLanguage !== undefined)
      item.detectedLanguage = detectedLanguage;

    const updated = await this.mediaRepo.save(item);

    // Re-embed if topic changed
    if (topicChanged && item.summary) {
      const embeddingText = `[${item.detectedLanguage}] [${item.detectedCefrLevel}] Topic: ${item.detectedTopic}\n${item.summary}`;
      this.embedding
        .generateEmbedding(embeddingText)
        .then(({ embedding }) =>
          this.mediaRepo
            .createQueryBuilder()
            .update()
            .set({
              embedding: pgvector.toSql(
                embedding,
              ) as unknown as string,
            })
            .where("id = :id", { id })
            .execute(),
        )
        .catch((err) => this.logger.warn("Re-embed failed:", err));
    }

    return { data: updated };
  }

  // DELETE /v1/media/:id — Delete media item
  async deleteMediaItem(
    id: string,
    academyId: string,
    ownerId: string,
  ) {
    const item = await this.mediaRepo.findOne({
      where: { id, academyId },
    });

    if (!item) {
      throw new NotFoundException("Media item not found");
    }

    // Delete from S3
    try {
      await this.storage.deleteFromS3(item.storageKey);
    } catch (err) {
      this.logger.warn("Failed to delete from S3:", err);
    }

    // Delete from DB (CASCADE removes pages)
    await this.mediaRepo.remove(item);

    // Decrement storage usage (negative increment)
    await this.usage.incrementUsage(
      ownerId,
      academyId,
      UsageMetric.STORAGE_BYTES,
      -item.fileSize,
    );

    return { deleted: true };
  }

  // POST /v1/media/bulk — Upload multiple files
  async uploadBulk(
    academyId: string,
    ownerId: string,
    files: Express.Multer.File[],
    cefrLevel?: string,
  ) {
    // Check storage limit
    const user = await this.userRepo.findOne({ where: { id: ownerId } });
    const plan = (user?.plan as UserPlan) ?? UserPlan.FREE;
    const storageCheck = await this.usage.checkPlanLimit(
      ownerId,
      plan,
      UsageMetric.STORAGE_BYTES,
    );
    if (!storageCheck.allowed) {
      throw new ForbiddenException(
        "Storage limit exceeded. Please upgrade your plan.",
      );
    }

    const normalizedCefr = cefrLevel?.trim().toUpperCase() ?? "";
    const validCefr = normalizedCefr && VALID_CEFR_LEVELS.includes(normalizedCefr) ? normalizedCefr : null;

    if (!files || files.length === 0) {
      throw new BadRequestException("No files provided");
    }
    if (files.length > MAX_FILES) {
      throw new BadRequestException(
        `Maximum ${MAX_FILES} files per request`,
      );
    }

    const results: { mediaItem: MediaItem; duplicate: boolean }[] = [];

    for (const file of files) {
      if (!file || file.size === 0) continue;
      if (file.size > MAX_FILE_SIZE) {
        results.push({
          mediaItem: {
            filename: file.originalname,
            status: "failed",
          } as MediaItem,
          duplicate: false,
        });
        continue;
      }

      const buffer = file.buffer;
      const contentHash = crypto
        .createHash("sha256")
        .update(buffer)
        .digest("hex");

      // Check duplicate
      const existing = await this.mediaRepo.findOne({
        where: { academyId, contentHash },
      });
      if (existing) {
        results.push({ mediaItem: await this.withPreviewUrl(existing), duplicate: true });
        continue;
      }

      // Upload to S3
      const ext = file.originalname.split(".").pop() ?? "bin";
      const storageKey = `media/${academyId}/${crypto.randomUUID()}.${ext}`;
      const storageUrl = await this.storage.uploadToS3(
        storageKey,
        buffer,
        file.mimetype || "application/octet-stream",
      );

      // Create record
      const item = new MediaItem();
      item.academyId = academyId;
      item.uploadedByUserId = ownerId;
      item.filename = file.originalname;
      item.mimeType = file.mimetype || "application/octet-stream";
      item.fileSize = file.size;
      item.contentHash = contentHash;
      item.storageKey = storageKey;
      item.storageUrl = storageUrl;
      item.status = "pending";
      item.detectedCefrLevel = validCefr;

      const saved = await this.mediaRepo.save(item);

      await this.usage.incrementUsage(
        ownerId,
        academyId,
        UsageMetric.STORAGE_BYTES,
        file.size,
      );

      // Fire-and-forget
      this.mediaProcessing
        .analyzeMediaItem(saved.id, ownerId, academyId)
        .catch((err) =>
          this.logger.error(
            "Background media analysis failed:",
            err,
          ),
        );

      results.push({ mediaItem: await this.withPreviewUrl(saved), duplicate: false });
    }

    return { data: results };
  }

  // POST /v1/media/search — Semantic search
  async searchMedia(
    academyId: string,
    ownerId: string,
    body: {
      query: string;
      limit?: number;
      mimeType?: string;
      tags?: string[];
    },
  ) {
    const { query, limit, mimeType, tags } = body;

    if (!query || typeof query !== "string") {
      throw new BadRequestException("query is required");
    }

    // Check AI token plan limit
    const user = await this.userRepo.findOne({ where: { id: ownerId } });
    const plan = (user?.plan as UserPlan) ?? UserPlan.FREE;
    const limitCheck = await this.usage.checkPlanLimit(
      ownerId,
      plan,
      UsageMetric.AI_TOKENS,
    );
    if (!limitCheck.allowed) {
      throw new ForbiddenException(
        "AI token limit exceeded. Please upgrade your plan.",
      );
    }

    const result = await this.mediaProcessing.findSimilarMedia({
      query,
      academyId,
      limit: limit ?? 10,
      mimeType,
      tags,
    });

    // Track AI token usage
    if (result.tokensUsed > 0) {
      await this.usage.incrementUsage(
        ownerId,
        academyId,
        UsageMetric.AI_TOKENS,
        result.tokensUsed,
      );
    }

    return {
      data: result.items,
      total: result.items.length,
      tokensUsed: result.tokensUsed,
    };
  }

  // POST /v1/media/:id/retry — Retry failed analysis
  async retryAnalysis(id: string, academyId: string) {
    const item = await this.mediaRepo.findOne({
      where: { id, academyId },
    });

    if (!item) {
      throw new NotFoundException("Media item not found");
    }

    // Fire-and-forget re-analysis
    this.mediaProcessing
      .analyzeMediaItem(item.id, item.uploadedByUserId, item.academyId)
      .catch((err) =>
        this.logger.error("Retry media analysis failed:", err),
      );

    return { message: "Analysis retry started", id: item.id };
  }
}
