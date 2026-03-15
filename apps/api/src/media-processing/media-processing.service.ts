import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import pgvector from "pgvector";
import { MediaItem } from "../database/entities/media-item.entity.js";
import { MediaPage } from "../database/entities/media-page.entity.js";
import { MediaChunk } from "../database/entities/media-chunk.entity.js";
import { UsageMetric } from "@langopia/shared/types";
import { StorageService } from "../storage/storage.service.js";
import { EmbeddingService } from "../embedding/embedding.service.js";
import { FileExtractService } from "../file-extract/file-extract.service.js";
import { UsageService } from "../usage/usage.service.js";

const MAX_TEXT_LENGTH = 8000;
const MAX_CHUNK_INPUT = 12000;
const MAX_CHUNK_SIZE = 3000;
const MIN_CHUNK_SIZE = 100;

@Injectable()
export class MediaProcessingService {
  private readonly logger = new Logger(MediaProcessingService.name);
  private openai: OpenAI | null = null;

  constructor(
    @InjectRepository(MediaItem)
    private readonly mediaRepo: Repository<MediaItem>,
    @InjectRepository(MediaPage)
    private readonly pageRepo: Repository<MediaPage>,
    @InjectRepository(MediaChunk)
    private readonly chunkRepo: Repository<MediaChunk>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly embedding: EmbeddingService,
    private readonly fileExtract: FileExtractService,
    private readonly usage: UsageService,
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
    cefrLevel: string | null,
  ): Promise<{
    detectedTopic: string;
    detectedLanguage: string;
    detectedCefrLevel: string | null;
    summary: string;
    tags: string[];
    tokensUsed: number;
  }> {
    const truncated = text.slice(0, MAX_TEXT_LENGTH);

    const cefrInstruction = cefrLevel
      ? `The teacher has classified this material as CEFR level: ${cefrLevel}. Verify if this classification is accurate and return the level in detectedCefrLevel.`
      : `Detect the CEFR level (A1, A2, B1, B2, C1, or C2) of this content based on vocabulary complexity, grammar structures, and topic sophistication. Return it in detectedCefrLevel.`;

    const response = await this.getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an educational content analyzer for a language learning platform.
${cefrInstruction}

Analyze the provided text and return JSON with these fields:

- detectedTopic: A specific, pedagogically useful topic description.
- detectedLanguage: ISO 639-1 language code of the content (e.g. "en", "es", "fr")
- detectedCefrLevel: The CEFR level of this content (A1, A2, B1, B2, C1, or C2)
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
      detectedCefrLevel: parsed.detectedCefrLevel ?? null,
      summary: parsed.summary ?? "",
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      tokensUsed,
    };
  }

  async analyzeMediaItem(
    mediaItemId: string,
    ownerId?: string,
    academyId?: string,
  ): Promise<void> {
    const item = await this.mediaRepo.findOne({
      where: { id: mediaItemId },
    });
    if (!item) return;

    const trackOwnerId = ownerId ?? item.uploadedByUserId;
    const trackAcademyId = academyId ?? item.academyId;
    let totalTokensUsed = 0;

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

      // Chunk document (non-fatal)
      try {
        const cefrForChunking = item.detectedCefrLevel || "B1";
        const chunkTokens = await this.chunkDocument(fullText, pages, cefrForChunking, mediaItemId);
        totalTokensUsed += chunkTokens;
      } catch (chunkErr) {
        this.logger.warn(`Document chunking failed for ${mediaItemId}:`, chunkErr);
      }

      if (!fullText.trim()) {
        await this.mediaRepo.update(mediaItemId, {
          status: "ready",
          summary:
            "No text content could be extracted from this file.",
        });
        return;
      }

      const cefrLevel = item.detectedCefrLevel || null;
      const analysis = await this.analyzeContent(fullText, cefrLevel);
      totalTokensUsed += analysis.tokensUsed;

      const effectiveCefr = analysis.detectedCefrLevel || cefrLevel || "B1";

      let embeddingSql: string | null = null;
      try {
        const embeddingText = `[${analysis.detectedLanguage}] [${effectiveCefr}] Topic: ${analysis.detectedTopic}\n${analysis.summary}\n${fullText.slice(0, 4000)}`;
        const { embedding, tokensUsed: embTokens } =
          await this.embedding.generateEmbedding(embeddingText);
        totalTokensUsed += embTokens;
        embeddingSql = pgvector.toSql(embedding);
      } catch (err) {
        this.logger.warn("Failed to generate media embedding:", err);
      }

      for (const page of pages) {
        if (page.text.trim().length < 50) continue;
        try {
          const { embedding, tokensUsed: pageEmbTokens } = await this.embedding.generateEmbedding(
            page.text.slice(0, MAX_TEXT_LENGTH),
          );
          totalTokensUsed += pageEmbTokens;
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

      if (totalTokensUsed > 0 && trackOwnerId && trackAcademyId) {
        await this.usage.incrementUsage(
          trackOwnerId,
          trackAcademyId,
          UsageMetric.AI_TOKENS,
          totalTokensUsed,
        );
      }

      await this.mediaRepo.update(mediaItemId, {
        status: "ready",
        detectedTopic: analysis.detectedTopic,
        detectedLanguage: analysis.detectedLanguage,
        detectedCefrLevel: analysis.detectedCefrLevel || cefrLevel || null,
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

  // ─── Chunking ──────────────────────────────────────────

  private async chunkDocument(
    fullText: string,
    pages: { pageNumber: number; text: string }[],
    cefrLevel: string,
    mediaItemId: string,
  ): Promise<number> {
    if (!fullText.trim()) return 0;

    let chunkTokensUsed = 0;

    let chunks: {
      chunkType: string;
      title: string | null;
      content: string;
      metadata: Record<string, unknown>;
      startPage: number;
      endPage: number;
    }[];

    // Short documents: single chunk, skip GPT
    if (fullText.length < 200) {
      chunks = [
        {
          chunkType: "other",
          title: null,
          content: fullText,
          metadata: {},
          startPage: 1,
          endPage: pages.length,
        },
      ];
    } else {
      // Build text with page markers
      let markedText = "";
      for (const page of pages) {
        markedText += `[PAGE ${page.pageNumber}]\n${page.text}\n\n`;
      }

      const truncated = markedText.slice(0, MAX_CHUNK_INPUT);

      try {
        const response = await this.getOpenAI().chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are an educational content analyzer. The material is CEFR level: ${cefrLevel}.

Analyze this document and identify distinct structural sections. For each section, determine its type from:
- vocabulary_list: Word lists, glossaries, vocabulary tables
- dialogue: Conversations, role-plays
- grammar_explanation: Grammar rules, structures, conjugation tables
- reading_passage: Articles, stories, texts for reading comprehension
- exercise: Practice activities, drills, questions
- instructions: Task instructions, rubrics
- cultural_note: Cultural information, country facts
- image_description: Description of visual content
- other: Content that doesn't fit above categories

Return a JSON array of chunks:
[{
  "chunkType": "vocabulary_list",
  "title": "Unit 3 - Food Vocabulary",
  "content": "the actual text content of this section",
  "startPage": 2,
  "endPage": 3,
  "metadata": {}
}]

Rules:
- Each chunk should be 100-2000 characters
- Preserve the original text faithfully
- Use page markers [PAGE N] to determine startPage/endPage
- Return ONLY valid JSON array, no markdown`,
            },
            { role: "user", content: truncated },
          ],
          response_format: { type: "json_object" },
          max_tokens: 4000,
        });

        chunkTokensUsed += response.usage?.total_tokens ?? 0;

        const raw = JSON.parse(
          response.choices[0]?.message?.content ?? "{}",
        );

        // Handle both {chunks: [...]} and direct array
        const parsed = Array.isArray(raw) ? raw : (raw.chunks ?? raw.sections ?? []);

        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error("GPT returned empty or invalid chunks");
        }

        const maxPage = pages.length;
        chunks = parsed.map(
          (c: {
            chunkType?: string;
            title?: string;
            content?: string;
            metadata?: Record<string, unknown>;
            startPage?: number;
            endPage?: number;
          }) => ({
            chunkType: c.chunkType ?? "other",
            title: c.title ?? null,
            content: c.content ?? "",
            metadata: c.metadata ?? {},
            startPage: Math.max(1, Math.min(c.startPage ?? 1, maxPage)),
            endPage: Math.max(1, Math.min(c.endPage ?? maxPage, maxPage)),
          }),
        );

        // Filter out empty chunks
        chunks = chunks.filter((c) => c.content.trim().length >= MIN_CHUNK_SIZE);
      } catch (gptErr) {
        this.logger.warn("GPT chunking failed, falling back to per-page:", gptErr);
        // Fallback: one chunk per page
        chunks = pages
          .filter((p) => p.text.trim().length >= MIN_CHUNK_SIZE)
          .map((p) => ({
            chunkType: "other",
            title: null,
            content: p.text,
            metadata: {},
            startPage: p.pageNumber,
            endPage: p.pageNumber,
          }));
      }
    }

    // Split oversized chunks at paragraph boundaries
    const finalChunks: typeof chunks = [];
    for (const chunk of chunks) {
      if (chunk.content.length <= MAX_CHUNK_SIZE) {
        finalChunks.push(chunk);
      } else {
        const paragraphs = chunk.content.split(/\n\n+/);
        let current = "";
        for (const para of paragraphs) {
          if (current.length + para.length > MAX_CHUNK_SIZE && current.length > 0) {
            finalChunks.push({ ...chunk, content: current.trim() });
            current = para;
          } else {
            current += (current ? "\n\n" : "") + para;
          }
        }
        if (current.trim()) {
          finalChunks.push({ ...chunk, content: current.trim() });
        }
      }
    }

    // Handle remaining text beyond MAX_CHUNK_INPUT
    if (fullText.length > MAX_CHUNK_INPUT) {
      const remainingText = fullText.slice(MAX_CHUNK_INPUT);
      const remainingParagraphs = remainingText.split(/\n\n+/);
      let current = "";
      for (const para of remainingParagraphs) {
        if (current.length + para.length > 1000 && current.length > 0) {
          finalChunks.push({
            chunkType: "other",
            title: null,
            content: current.trim(),
            metadata: {},
            startPage: pages.length,
            endPage: pages.length,
          });
          current = para;
        } else {
          current += (current ? "\n\n" : "") + para;
        }
      }
      if (current.trim().length >= MIN_CHUNK_SIZE) {
        finalChunks.push({
          chunkType: "other",
          title: null,
          content: current.trim(),
          metadata: {},
          startPage: pages.length,
          endPage: pages.length,
        });
      }
    }

    // Save chunks
    for (let i = 0; i < finalChunks.length; i++) {
      const c = finalChunks[i];
      const chunk = new MediaChunk();
      chunk.mediaItemId = mediaItemId;
      chunk.chunkType = c.chunkType;
      chunk.title = c.title;
      chunk.content = c.content;
      chunk.metadata = c.metadata;
      chunk.startPage = c.startPage;
      chunk.endPage = c.endPage;
      chunk.orderIndex = i;
      await this.chunkRepo.save(chunk);
    }

    // Generate embeddings for chunks
    for (let i = 0; i < finalChunks.length; i++) {
      try {
        const c = finalChunks[i];
        const prefix = `[${c.chunkType}]${c.title ? ` ${c.title}:` : ""}`;
        const embText = `${prefix} ${c.content}`.slice(0, MAX_TEXT_LENGTH);
        const { embedding, tokensUsed: chunkEmbTokens } = await this.embedding.generateEmbedding(embText);
        chunkTokensUsed += chunkEmbTokens;

        await this.chunkRepo
          .createQueryBuilder()
          .update()
          .set({
            embedding: pgvector.toSql(embedding) as unknown as string,
          })
          .where(
            "mediaItemId = :mediaItemId AND orderIndex = :orderIndex",
            { mediaItemId, orderIndex: i },
          )
          .execute();
      } catch {
        // Non-fatal: skip chunk embedding
      }
    }

    return chunkTokensUsed;
  }

  // ─── RAG Retrieval ────────────────────────────────────

  async findRelevantChunks(opts: {
    mediaItemIds: string[];
    query: string;
    topK?: number;
  }): Promise<{ chunks: MediaChunk[]; tokensUsed: number }> {
    const { mediaItemIds, query, topK = 10 } = opts;

    if (mediaItemIds.length === 0) {
      return { chunks: [], tokensUsed: 0 };
    }

    const { embedding, tokensUsed } =
      await this.embedding.generateEmbedding(query);

    const embSql = pgvector.toSql(embedding);

    const chunks = await this.chunkRepo
      .createQueryBuilder("chunk")
      .addSelect(`chunk.embedding <=> :embeddingParam`, "distance")
      .where("chunk.mediaItemId IN (:...mediaItemIds)", { mediaItemIds })
      .andWhere("chunk.embedding IS NOT NULL")
      .orderBy(`chunk.embedding <=> :embeddingParam`, "ASC")
      .setParameter("embeddingParam", embSql)
      .take(topK)
      .getMany();

    return { chunks, tokensUsed };
  }

  formatChunksAsContext(chunks: MediaChunk[]): string {
    return chunks
      .map((c) => {
        const header = `=== [${c.chunkType.toUpperCase()}]${c.title ? ` "${c.title}"` : ""} (pages ${c.startPage}-${c.endPage}) ===`;
        return `${header}\n${c.content}`;
      })
      .join("\n\n");
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
