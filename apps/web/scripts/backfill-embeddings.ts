import "reflect-metadata";
import { DataSource } from "typeorm";
import OpenAI from "openai";
import pgvector from "pgvector";
import {
  User,
  Academy,
  AcademyMember,
  Student,
  Lesson,
  LearningPath,
  LearningPathLesson,
  Class,
  ClassStudent,
  Room,
  RoomParticipant,
  RoomNotes,
  ChatMessage,
  Transcription,
  ClassReport,
  Exercise,
  LessonExercise,
  ReportExercise,
  UsageRecord,
} from "../src/entities";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 50;

function buildEmbeddingText(exercise: Exercise): string {
  const parts: string[] = [];
  parts.push(`[${exercise.language}] [${exercise.cefrLevel}] [${exercise.targetSkill}]`);
  if (exercise.title) parts.push(`Title: ${exercise.title}`);
  if (exercise.topic) parts.push(`Topic: ${exercise.topic}`);
  parts.push(`Type: ${exercise.type}`);
  parts.push(`Instruction: ${exercise.instruction}`);
  parts.push(`Content: ${exercise.content}`);
  return parts.join("\n").slice(0, 8000);
}

function buildTopicEmbeddingText(exercise: Exercise): string {
  const parts: string[] = [];
  parts.push(`[${exercise.language}] [${exercise.cefrLevel}] [${exercise.targetSkill}]`);
  if (exercise.title) parts.push(exercise.title);
  if (exercise.topic) parts.push(exercise.topic);
  parts.push(`Type: ${exercise.type}`);
  return parts.join(" ").slice(0, 8000);
}

async function main() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const ds = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities: [
      User, Academy, AcademyMember, Student, Lesson, LearningPath,
      LearningPathLesson, Class, ClassStudent, Room, RoomParticipant,
      RoomNotes, ChatMessage, Transcription, ClassReport,
      Exercise, LessonExercise, ReportExercise, UsageRecord,
    ],
    synchronize: false,
    logging: false,
  });

  await ds.initialize();

  const total = await ds.getRepository(Exercise)
    .createQueryBuilder("e")
    .where(`e.embedding IS NULL OR e."topicEmbedding" IS NULL`)
    .getCount();

  console.log(`Found ${total} exercises needing embeddings.`);
  if (total === 0) {
    await ds.destroy();
    return;
  }

  let processed = 0;
  let totalTokens = 0;

  while (processed < total) {
    const exercises = await ds.getRepository(Exercise)
      .createQueryBuilder("e")
      .where(`e.embedding IS NULL OR e."topicEmbedding" IS NULL`)
      .orderBy("e.createdAt", "ASC")
      .take(BATCH_SIZE)
      .getMany();

    if (exercises.length === 0) break;

    // Build texts for both embedding types
    const contentTexts = exercises.map(buildEmbeddingText);
    const topicTexts = exercises.map(buildTopicEmbeddingText);

    // Generate both embedding batches in parallel
    const [contentResponse, topicResponse] = await Promise.all([
      openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: contentTexts,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
      openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: topicTexts,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    ]);

    totalTokens += (contentResponse.usage?.total_tokens ?? 0) + (topicResponse.usage?.total_tokens ?? 0);

    for (let i = 0; i < exercises.length; i++) {
      const contentEmbedding = contentResponse.data[i].embedding;
      const topicEmbedding = topicResponse.data[i].embedding;
      await ds.getRepository(Exercise)
        .createQueryBuilder()
        .update()
        .set({
          embedding: pgvector.toSql(contentEmbedding) as unknown as string,
          topicEmbedding: pgvector.toSql(topicEmbedding) as unknown as string,
        })
        .where("id = :id", { id: exercises[i].id })
        .execute();
    }

    processed += exercises.length;
    console.log(`Processed ${processed}/${total} (tokens used: ${totalTokens})`);
  }

  console.log(`Done. Total tokens used: ${totalTokens}`);
  await ds.destroy();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
