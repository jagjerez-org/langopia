import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import pgvector from "pgvector";
import { Exercise } from "../database/entities/exercise.entity.js";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const MAX_TEXT_LENGTH = 8000;
const BATCH_SIZE = 20;

export const DISTANCE_THRESHOLD_DEDUP = 0.35;
export const DISTANCE_THRESHOLD_TOPIC = 0.45;
export const DISTANCE_THRESHOLD_SEARCH = 0.6;

export interface SimilarExercise extends Exercise {
  distance: number;
}

export interface DedupCandidate extends Exercise {
  distance: number;
  matchType: "topic" | "content";
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private openai: OpenAI | null = null;

  constructor(
    @InjectRepository(Exercise)
    private readonly exerciseRepo: Repository<Exercise>,
    private readonly config: ConfigService,
  ) {}

  private getOpenAI(): OpenAI {
    if (!this.openai) {
      this.openai = new OpenAI({
        apiKey: this.config.get<string>("OPENAI_API_KEY"),
      });
    }
    return this.openai;
  }

  buildEmbeddingText(exercise: Exercise): string {
    const parts: string[] = [];
    parts.push(
      `[${exercise.language}] [${exercise.cefrLevel}] [${exercise.targetSkill}]`,
    );
    if (exercise.title) parts.push(`Title: ${exercise.title}`);
    if (exercise.topic) parts.push(`Topic: ${exercise.topic}`);
    parts.push(`Type: ${exercise.type}`);
    parts.push(`Instruction: ${exercise.instruction}`);
    parts.push(`Content: ${exercise.content}`);
    return parts.join("\n").slice(0, MAX_TEXT_LENGTH);
  }

  buildTopicEmbeddingText(exercise: Exercise): string {
    const parts: string[] = [];
    parts.push(
      `[${exercise.language}] [${exercise.cefrLevel}] [${exercise.targetSkill}]`,
    );
    if (exercise.title) parts.push(exercise.title);
    if (exercise.topic) parts.push(exercise.topic);
    parts.push(`Type: ${exercise.type}`);
    return parts.join(" ").slice(0, MAX_TEXT_LENGTH);
  }

  async generateEmbedding(
    text: string,
  ): Promise<{ embedding: number[]; tokensUsed: number }> {
    const response = await this.getOpenAI().embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    return {
      embedding: response.data[0].embedding,
      tokensUsed: response.usage?.total_tokens ?? 0,
    };
  }

  async embedExercise(exerciseId: string): Promise<number> {
    const exercise = await this.exerciseRepo.findOne({
      where: { id: exerciseId },
    });
    if (!exercise) return 0;

    const contentText = this.buildEmbeddingText(exercise);
    const topicText = this.buildTopicEmbeddingText(exercise);

    const [contentResult, topicResult] = await Promise.all([
      this.generateEmbedding(contentText),
      this.generateEmbedding(topicText),
    ]);

    await this.exerciseRepo
      .createQueryBuilder()
      .update()
      .set({
        embedding: pgvector.toSql(
          contentResult.embedding,
        ) as unknown as string,
        topicEmbedding: pgvector.toSql(
          topicResult.embedding,
        ) as unknown as string,
      })
      .where("id = :id", { id: exerciseId })
      .execute();

    return contentResult.tokensUsed + topicResult.tokensUsed;
  }

  async embedExercises(ids: string[]): Promise<number> {
    let totalTokens = 0;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((id) => this.embedExercise(id)),
      );
      totalTokens += results.reduce((sum, t) => sum + t, 0);
    }
    return totalTokens;
  }

  async findSimilarExercises(opts: {
    query: string;
    academyId: string;
    limit?: number;
    language?: string;
    cefrLevel?: string;
    targetSkill?: string;
    excludeIds?: string[];
    mode?: "topic" | "content";
    distanceThreshold?: number;
  }): Promise<{ exercises: SimilarExercise[]; tokensUsed: number }> {
    const {
      query,
      academyId,
      limit = 10,
      language,
      cefrLevel,
      targetSkill,
      excludeIds,
      mode = "content",
      distanceThreshold,
    } = opts;

    const { embedding, tokensUsed } = await this.generateEmbedding(query);
    const embeddingColumn =
      mode === "topic" ? "topicEmbedding" : "embedding";

    const qb = this.exerciseRepo
      .createQueryBuilder("exercise")
      .addSelect(
        `exercise."${embeddingColumn}" <=> :embeddingParam`,
        "distance",
      )
      .where("exercise.academyId = :academyId", { academyId })
      .andWhere(`exercise."${embeddingColumn}" IS NOT NULL`)
      .orderBy(`exercise."${embeddingColumn}" <=> :embeddingParam`, "ASC")
      .setParameter("embeddingParam", pgvector.toSql(embedding))
      .take(limit);

    if (distanceThreshold !== undefined) {
      qb.andWhere(
        `exercise."${embeddingColumn}" <=> :embeddingParam < :threshold`,
        { threshold: distanceThreshold },
      );
    }
    if (language)
      qb.andWhere("exercise.language = :language", { language });
    if (cefrLevel)
      qb.andWhere("exercise.cefrLevel = :cefrLevel", { cefrLevel });
    if (targetSkill)
      qb.andWhere("exercise.targetSkill = :targetSkill", { targetSkill });
    if (excludeIds && excludeIds.length > 0) {
      qb.andWhere("exercise.id NOT IN (:...excludeIds)", { excludeIds });
    }

    const { entities, raw } = await qb.getRawAndEntities();

    const exercises: SimilarExercise[] = entities.map((entity, i) => {
      const distance = parseFloat(raw[i]?.distance ?? "1");
      return Object.assign(entity, { distance });
    });

    return { exercises, tokensUsed };
  }

  async findDedupCandidates(opts: {
    topic: string;
    materialContext?: string;
    academyId: string;
    language?: string;
    cefrLevel?: string;
  }): Promise<{ candidates: DedupCandidate[]; tokensUsed: number }> {
    const { topic, materialContext, academyId, language, cefrLevel } = opts;
    let totalTokens = 0;

    const topicQuery =
      `${language ?? ""} ${cefrLevel ?? ""} ${topic}`.trim();
    const { exercises: topicResults, tokensUsed: topicTokens } =
      await this.findSimilarExercises({
        query: topicQuery,
        academyId,
        language,
        cefrLevel,
        limit: 15,
        mode: "topic",
        distanceThreshold: DISTANCE_THRESHOLD_TOPIC,
      });
    totalTokens += topicTokens;

    const seenIds = new Set(topicResults.map((e) => e.id));
    const candidates: DedupCandidate[] = topicResults.map((e) =>
      Object.assign(e, { matchType: "topic" as const }),
    );

    if (materialContext) {
      const contentQuery = `${topic} ${materialContext.slice(0, 500)}`;
      const { exercises: contentResults, tokensUsed: contentTokens } =
        await this.findSimilarExercises({
          query: contentQuery,
          academyId,
          language,
          cefrLevel,
          limit: 10,
          mode: "content",
          distanceThreshold: DISTANCE_THRESHOLD_DEDUP,
        });
      totalTokens += contentTokens;

      for (const e of contentResults) {
        if (!seenIds.has(e.id)) {
          seenIds.add(e.id);
          candidates.push(
            Object.assign(e, { matchType: "content" as const }),
          );
        }
      }
    }

    candidates.sort((a, b) => a.distance - b.distance);
    return { candidates, tokensUsed: totalTokens };
  }

  async searchExercisesForRAG(opts: {
    query: string;
    academyId: string;
    language?: string;
    cefrLevel?: string;
    limit?: number;
  }): Promise<{ results: string; tokensUsed: number }> {
    const { query, academyId, language, cefrLevel, limit = 5 } = opts;

    const { exercises, tokensUsed } = await this.findSimilarExercises({
      query,
      academyId,
      language,
      cefrLevel,
      limit,
      mode: "content",
      distanceThreshold: DISTANCE_THRESHOLD_SEARCH,
    });

    if (exercises.length === 0) {
      return {
        results: "No similar exercises found in the database.",
        tokensUsed,
      };
    }

    const formatted = exercises
      .map((e, i) => {
        const similarity =
          e.distance < DISTANCE_THRESHOLD_DEDUP
            ? "VERY_HIGH"
            : e.distance < DISTANCE_THRESHOLD_TOPIC
              ? "HIGH"
              : "MEDIUM";
        return `[${i + 1}] Similarity: ${similarity} (distance: ${e.distance.toFixed(3)})
  Type: ${e.type} | Skill: ${e.targetSkill}
  Title: ${e.title || "Untitled"}
  Instruction: ${e.instruction}
  Content: ${e.content.slice(0, 300)}
  ${e.options ? `Options: ${e.options.join(", ")}` : ""}
  ${e.correctAnswer ? `Answer: ${e.correctAnswer}` : ""}`;
      })
      .join("\n---\n");

    return { results: formatted, tokensUsed };
  }
}
