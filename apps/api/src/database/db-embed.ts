import "reflect-metadata";
import { DataSource } from "typeorm";
import OpenAI from "openai";
import pgvector from "pgvector";
import { entities } from "./entities/index.js";
import { Exercise } from "./entities/exercise.entity.js";

const MODEL = "text-embedding-3-small";
const DIMS = 1536;
const BATCH = 50;
const MAX_TEXT_LENGTH = 8000;

function buildEmbeddingText(e: Exercise): string {
  const parts: string[] = [];
  parts.push(`[${e.language}] [${e.cefrLevel}] [${e.targetSkill}]`);
  if (e.title) parts.push(`Title: ${e.title}`);
  if (e.topic) parts.push(`Topic: ${e.topic}`);
  parts.push(`Type: ${e.type}`);
  parts.push(`Instruction: ${e.instruction}`);
  parts.push(`Content: ${e.content}`);
  return parts.join("\n").slice(0, MAX_TEXT_LENGTH);
}

function buildTopicEmbeddingText(e: Exercise): string {
  const parts: string[] = [];
  parts.push(`[${e.language}] [${e.cefrLevel}] [${e.targetSkill}]`);
  if (e.title) parts.push(e.title);
  if (e.topic) parts.push(e.topic);
  parts.push(`Type: ${e.type}`);
  return parts.join(" ").slice(0, MAX_TEXT_LENGTH);
}

async function embedBatch(
  openai: OpenAI,
  texts: string[],
): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: MODEL,
    input: texts,
    dimensions: DIMS,
  });
  return response.data.map((d) => d.embedding);
}

async function main() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const ds = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities,
    synchronize: false,
  });
  await ds.initialize();

  const repo = ds.getRepository(Exercise);

  const total = await repo
    .createQueryBuilder("e")
    .where('e.embedding IS NULL OR e."topicEmbedding" IS NULL')
    .getCount();

  console.log(`Found ${total} exercises needing embeddings.`);
  if (total === 0) {
    await ds.destroy();
    return;
  }

  let processed = 0;
  let totalTokens = 0;

  while (processed < total) {
    const exercises = await repo
      .createQueryBuilder("e")
      .where('e.embedding IS NULL OR e."topicEmbedding" IS NULL')
      .orderBy("e.createdAt", "ASC")
      .take(BATCH)
      .getMany();

    if (exercises.length === 0) break;

    const contentTexts = exercises.map(buildEmbeddingText);
    const topicTexts = exercises.map(buildTopicEmbeddingText);

    const [contentEmbeddings, topicEmbeddings] = await Promise.all([
      embedBatch(openai, contentTexts),
      embedBatch(openai, topicTexts),
    ]);

    for (let i = 0; i < exercises.length; i++) {
      await repo
        .createQueryBuilder()
        .update()
        .set({
          embedding: pgvector.toSql(contentEmbeddings[i]) as unknown as string,
          topicEmbedding: pgvector.toSql(topicEmbeddings[i]) as unknown as string,
        })
        .where("id = :id", { id: exercises[i].id })
        .execute();
    }

    processed += exercises.length;
    console.log(`Embedded ${processed}/${total} exercises`);
  }

  console.log(`Done. Processed ${processed} exercises.`);
  await ds.destroy();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
