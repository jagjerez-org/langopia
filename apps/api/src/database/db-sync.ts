import "reflect-metadata";
import { DataSource } from "typeorm";
import { entities } from "./entities/index.js";

async function main() {
  // 1. Enable pgvector extension (without entity sync — avoids "type vector does not exist" errors)
  const preDs = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities: [],
    synchronize: false,
    logging: true,
  });
  await preDs.initialize();
  await preDs.query("CREATE EXTENSION IF NOT EXISTS vector");
  await preDs.destroy();

  // 2. Full schema sync with all entities
  const ds = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities,
    synchronize: true,
    logging: true,
  });
  await ds.initialize();
  console.log("Database synchronized successfully!");

  // 3. Create HNSW indexes for vector similarity search
  const indexes = [
    { table: "exercises", col: "embedding", name: "idx_exercises_embedding_hnsw" },
    { table: "exercises", col: "topicEmbedding", name: "idx_exercises_topic_embedding_hnsw" },
    { table: "media_items", col: "embedding", name: "idx_media_items_embedding_hnsw" },
    { table: "media_pages", col: "embedding", name: "idx_media_pages_embedding_hnsw" },
  ];
  for (const { table, col, name } of indexes) {
    await ds.query(`
      CREATE INDEX IF NOT EXISTS ${name}
      ON ${table} USING hnsw ("${col}" vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);
  }
  console.log("HNSW indexes created/verified.");

  await ds.destroy();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
