import OpenAI from "openai";
import pgvector from "pgvector";
import { getDataSource } from "@/lib/database";
import { MediaItem, MediaPage } from "@/entities";
import { getFromS3 } from "@/lib/s3";
import { extractTextPerPageFromBuffer } from "@/lib/file-extract";
import { generateEmbedding } from "@/lib/embeddings";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

const MAX_TEXT_LENGTH = 8000;

interface ContentAnalysis {
  detectedTopic: string;
  detectedLanguage: string;
  summary: string;
  tags: string[];
  tokensUsed: number;
}

async function analyzeContent(text: string, cefrLevel: string): Promise<ContentAnalysis> {
  const truncated = text.slice(0, MAX_TEXT_LENGTH);

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are an educational content analyzer for a language learning platform.
The teacher has classified this material as CEFR level: ${cefrLevel}.

Analyze the provided text and return JSON with these fields:

- detectedTopic: A specific, pedagogically useful topic description. Be precise about what language skills or knowledge this content teaches. Avoid generic labels.
  BAD: "Grammar", "Vocabulary", "Business English", "Travel"
  GOOD: "Past Simple vs Present Perfect in narrative contexts", "Hotel reservation vocabulary and polite request phrases", "Formal email writing: complaints and follow-ups", "Comparative and superlative adjectives for describing cities"

- detectedLanguage: ISO 639-1 language code of the content (e.g. "en", "es", "fr")

- summary: 2-3 sentence summary of the content, mentioning what a teacher could use it for

- tags: array of 5-7 specific tags for categorization (lowercase). Include:
  * The primary skill area (reading, writing, listening, speaking, grammar, vocabulary)
  * Specific grammar points or vocabulary themes covered (e.g. "past-simple", "conditionals", "food-vocabulary")
  * The context or domain (e.g. "travel", "business", "academic", "daily-life", "medical")
  BAD: ["english", "education", "learning", "language", "teaching"]
  GOOD: ["reading", "past-simple", "present-perfect", "narrative", "storytelling", "B1"]

Return ONLY valid JSON, no markdown.`,
      },
      {
        role: "user",
        content: truncated,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 500,
  });

  const tokensUsed = response.usage?.total_tokens ?? 0;
  const parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}");

  return {
    detectedTopic: parsed.detectedTopic ?? "Unknown",
    detectedLanguage: parsed.detectedLanguage ?? "en",
    summary: parsed.summary ?? "",
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    tokensUsed,
  };
}

/**
 * Main media analysis pipeline. Processes a MediaItem:
 * 1. Downloads file from S3
 * 2. Extracts text per page
 * 3. Runs AI analysis (topic, language, CEFR, tags, summary)
 * 4. Generates embeddings
 * 5. Counts similar exercises
 */
export async function analyzeMediaItem(mediaItemId: string): Promise<void> {
  const ds = await getDataSource();
  const repo = ds.getRepository(MediaItem);
  const pageRepo = ds.getRepository(MediaPage);

  const item = await repo.findOne({ where: { id: mediaItemId } });
  if (!item) return;

  try {
    // 1. Set status → processing
    await repo.update(mediaItemId, { status: "processing" });

    // 2. Download file from S3
    const buffer = await getFromS3(item.storageKey);

    // 3. Extract text per page
    const pages = await extractTextPerPageFromBuffer(buffer, item.filename, item.mimeType);

    // 4. Create MediaPage records
    await repo.update(mediaItemId, { totalPages: pages.length });

    for (const page of pages) {
      const mediaPage = new MediaPage();
      mediaPage.mediaItemId = mediaItemId;
      mediaPage.pageNumber = page.pageNumber;
      mediaPage.extractedText = page.text;
      await pageRepo.save(mediaPage);

      // Update progress
      await repo.update(mediaItemId, { processedPages: page.pageNumber });
    }

    // 5. Concatenate all page texts
    const fullText = pages.map((p) => p.text).join("\n\n");

    if (!fullText.trim()) {
      await repo.update(mediaItemId, {
        status: "ready",
        summary: "No text content could be extracted from this file.",
      });
      return;
    }

    // 6. AI analysis (cefrLevel already set at upload time)
    const cefrLevel = item.detectedCefrLevel || "B1";
    const analysis = await analyzeContent(fullText, cefrLevel);

    // 7. Generate document embedding
    let embeddingSql: string | null = null;
    let embeddingTokens = 0;
    try {
      const embeddingText = `[${analysis.detectedLanguage}] [${cefrLevel}] Topic: ${analysis.detectedTopic}\n${analysis.summary}\n${fullText.slice(0, 4000)}`;
      const { embedding, tokensUsed } = await generateEmbedding(embeddingText);
      embeddingSql = pgvector.toSql(embedding);
      embeddingTokens = tokensUsed;
    } catch (err) {
      console.warn("Failed to generate media embedding:", err);
    }

    // 8. Generate per-page embeddings (batch, best-effort)
    for (const page of pages) {
      if (page.text.trim().length < 50) continue;
      try {
        const { embedding } = await generateEmbedding(page.text.slice(0, MAX_TEXT_LENGTH));
        await pageRepo
          .createQueryBuilder()
          .update()
          .set({ embedding: pgvector.toSql(embedding) as unknown as string })
          .where("mediaItemId = :mediaItemId AND pageNumber = :pageNumber", {
            mediaItemId,
            pageNumber: page.pageNumber,
          })
          .execute();
      } catch {
        // Non-fatal: skip page embedding
      }
    }

    // 9. Count similar exercises
    let similarCount = 0;
    try {
      if (embeddingSql) {
        const result = await ds.query(
          `SELECT COUNT(*) as cnt FROM exercises
           WHERE "academyId" = $1 AND "topicEmbedding" IS NOT NULL
           AND ("topicEmbedding" <=> $2) < 0.45`,
          [item.academyId, embeddingSql]
        );
        similarCount = parseInt(result[0]?.cnt ?? "0", 10);
      }
    } catch {
      // Non-fatal
    }

    // 10. Update item with analysis results (cefrLevel not overwritten — set at upload)
    await repo.update(mediaItemId, {
      status: "ready",
      detectedTopic: analysis.detectedTopic,
      detectedLanguage: analysis.detectedLanguage,
      summary: analysis.summary,
      tags: analysis.tags as unknown as string[],
      similarExerciseCount: similarCount,
    } as Record<string, unknown>);

    // Set embedding via raw query (TypeORM vector handling)
    if (embeddingSql) {
      await ds
        .getRepository(MediaItem)
        .createQueryBuilder()
        .update()
        .set({ embedding: embeddingSql as unknown as string })
        .where("id = :id", { id: mediaItemId })
        .execute();
    }
  } catch (err) {
    console.error(`Media analysis failed for ${mediaItemId}:`, err);
    await repo.update(mediaItemId, { status: "failed" });
  }
}

/**
 * Find media items semantically similar to a query string.
 */
export async function findSimilarMedia(opts: {
  query: string;
  academyId: string;
  limit?: number;
  mimeType?: string;
  tags?: string[];
}): Promise<{ items: MediaItem[]; tokensUsed: number }> {
  const { query, academyId, limit = 10, mimeType, tags } = opts;

  const { embedding, tokensUsed } = await generateEmbedding(query);

  const ds = await getDataSource();
  const qb = ds
    .getRepository(MediaItem)
    .createQueryBuilder("media")
    .addSelect(`media.embedding <=> :embeddingParam`, "distance")
    .where("media.academyId = :academyId", { academyId })
    .andWhere("media.embedding IS NOT NULL")
    .andWhere("media.status = :status", { status: "ready" })
    .orderBy(`media.embedding <=> :embeddingParam`, "ASC")
    .setParameter("embeddingParam", pgvector.toSql(embedding))
    .take(limit);

  if (mimeType) qb.andWhere("media.mimeType = :mimeType", { mimeType });
  if (tags && tags.length > 0) {
    qb.andWhere("media.tags @> :tags", { tags: JSON.stringify(tags) });
  }

  const items = await qb.getMany();

  return { items, tokensUsed };
}
