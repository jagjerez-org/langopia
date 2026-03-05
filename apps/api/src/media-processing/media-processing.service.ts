import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import pgvector from "pgvector";
import { MediaItem } from "../database/entities/media-item.entity.js";
import { MediaPage } from "../database/entities/media-page.entity.js";
import { StorageService } from "../storage/storage.service.js";
import { EmbeddingService } from "../embedding/embedding.service.js";
import { FileExtractService } from "../file-extract/file-extract.service.js";

const MAX_TEXT_LENGTH = 8000;

@Injectable()
export class MediaProcessingService {
  private readonly logger = new Logger(MediaProcessingService.name);
  private openai: OpenAI | null = null;

  constructor(
    @InjectRepository(MediaItem)
    private readonly mediaRepo: Repository<MediaItem>,
    @InjectRepository(MediaPage)
    private readonly pageRepo: Repository<MediaPage>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly embedding: EmbeddingService,
    private readonly fileExtract: FileExtractService,
  ) {}

  private getOpenAI(): OpenAI {
    if (!this.openai) {
      this.openai = new OpenAI({
        apiKey: this.config.get<string>("OPENAI_API_KEY"),
      });
    }
    return this.openai;
  }

  private async analyzeContent(
    text: string,
    cefrLevel: string,
  ): Promise<{
    detectedTopic: string;
    detectedLanguage: string;
    summary: string;
    tags: string[];
    tokensUsed: number;
  }> {
    const truncated = text.slice(0, MAX_TEXT_LENGTH);

    const response = await this.getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an educational content analyzer for a language learning platform.
The teacher has classified this material as CEFR level: ${cefrLevel}.

Analyze the provided text and return JSON with these fields:

- detectedTopic: A specific, pedagogically useful topic description.
- detectedLanguage: ISO 639-1 language code of the content (e.g. "en", "es", "fr")
- summary: 2-3 sentence summary of the content
- tags: array of 5-7 specific tags for categorization (lowercase)

Return ONLY valid JSON, no markdown.`,
        },
        { role: "user", content: truncated },
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
    });

    const tokensUsed = response.usage?.total_tokens ?? 0;
    const parsed = JSON.parse(
      response.choices[0]?.message?.content ?? "{}",
    );

    return {
      detectedTopic: parsed.detectedTopic ?? "Unknown",
      detectedLanguage: parsed.detectedLanguage ?? "en",
      summary: parsed.summary ?? "",
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      tokensUsed,
    };
  }

  async analyzeMediaItem(mediaItemId: string): Promise<void> {
    const item = await this.mediaRepo.findOne({
      where: { id: mediaItemId },
    });
    if (!item) return;

    try {
      await this.mediaRepo.update(mediaItemId, { status: "processing" });

      const buffer = await this.storage.getFromS3(item.storageKey);
      const pages = await this.fileExtract.extractTextPerPageFromBuffer(
        buffer,
        item.filename,
        item.mimeType,
      );

      await this.mediaRepo.update(mediaItemId, {
        totalPages: pages.length,
      });

      for (const page of pages) {
        const mediaPage = new MediaPage();
        mediaPage.mediaItemId = mediaItemId;
        mediaPage.pageNumber = page.pageNumber;
        mediaPage.extractedText = page.text;
        await this.pageRepo.save(mediaPage);
        await this.mediaRepo.update(mediaItemId, {
          processedPages: page.pageNumber,
        });
      }

      const fullText = pages.map((p) => p.text).join("\n\n");

      if (!fullText.trim()) {
        await this.mediaRepo.update(mediaItemId, {
          status: "ready",
          summary:
            "No text content could be extracted from this file.",
        });
        return;
      }

      const cefrLevel = item.detectedCefrLevel || "B1";
      const analysis = await this.analyzeContent(fullText, cefrLevel);

      let embeddingSql: string | null = null;
      try {
        const embeddingText = `[${analysis.detectedLanguage}] [${cefrLevel}] Topic: ${analysis.detectedTopic}\n${analysis.summary}\n${fullText.slice(0, 4000)}`;
        const { embedding } =
          await this.embedding.generateEmbedding(embeddingText);
        embeddingSql = pgvector.toSql(embedding);
      } catch (err) {
        this.logger.warn("Failed to generate media embedding:", err);
      }

      for (const page of pages) {
        if (page.text.trim().length < 50) continue;
        try {
          const { embedding } = await this.embedding.generateEmbedding(
            page.text.slice(0, MAX_TEXT_LENGTH),
          );
          await this.pageRepo
            .createQueryBuilder()
            .update()
            .set({
              embedding: pgvector.toSql(
                embedding,
              ) as unknown as string,
            })
            .where(
              "mediaItemId = :mediaItemId AND pageNumber = :pageNumber",
              { mediaItemId, pageNumber: page.pageNumber },
            )
            .execute();
        } catch {
          // Non-fatal: skip page embedding
        }
      }

      let similarCount = 0;
      try {
        if (embeddingSql) {
          const result = await this.dataSource.query(
            `SELECT COUNT(*) as cnt FROM exercises
             WHERE "academyId" = $1 AND "topicEmbedding" IS NOT NULL
             AND ("topicEmbedding" <=> $2) < 0.45`,
            [item.academyId, embeddingSql],
          );
          similarCount = parseInt(result[0]?.cnt ?? "0", 10);
        }
      } catch {
        // Non-fatal
      }

      await this.mediaRepo.update(mediaItemId, {
        status: "ready",
        detectedTopic: analysis.detectedTopic,
        detectedLanguage: analysis.detectedLanguage,
        summary: analysis.summary,
        tags: analysis.tags as unknown as string[],
        similarExerciseCount: similarCount,
      } as Record<string, unknown>);

      if (embeddingSql) {
        await this.mediaRepo
          .createQueryBuilder()
          .update()
          .set({ embedding: embeddingSql as unknown as string })
          .where("id = :id", { id: mediaItemId })
          .execute();
      }
    } catch (err) {
      this.logger.error(
        `Media analysis failed for ${mediaItemId}:`,
        err,
      );
      await this.mediaRepo.update(mediaItemId, { status: "failed" });
    }
  }

  async findSimilarMedia(opts: {
    query: string;
    academyId: string;
    limit?: number;
    mimeType?: string;
    tags?: string[];
  }): Promise<{ items: MediaItem[]; tokensUsed: number }> {
    const { query, academyId, limit = 10, mimeType, tags } = opts;

    const { embedding, tokensUsed } =
      await this.embedding.generateEmbedding(query);

    const qb = this.mediaRepo
      .createQueryBuilder("media")
      .addSelect(`media.embedding <=> :embeddingParam`, "distance")
      .where("media.academyId = :academyId", { academyId })
      .andWhere("media.embedding IS NOT NULL")
      .andWhere("media.status = :status", { status: "ready" })
      .orderBy(`media.embedding <=> :embeddingParam`, "ASC")
      .setParameter("embeddingParam", pgvector.toSql(embedding))
      .take(limit);

    if (mimeType)
      qb.andWhere("media.mimeType = :mimeType", { mimeType });
    if (tags && tags.length > 0) {
      qb.andWhere("media.tags @> :tags", {
        tags: JSON.stringify(tags),
      });
    }

    const items = await qb.getMany();
    return { items, tokensUsed };
  }
}
