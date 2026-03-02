import "reflect-metadata";
import { DataSource } from "typeorm";
import {
  User,
  Academy,
  AcademyMember,
  Student,
  Room,
  RoomParticipant,
  RoomNotes,
  ChatMessage,
  Transcription,
  ClassReport,
  ExerciseTemplate,
  Exercise,
  UsageRecord,
} from "../src/entities";

async function main() {
  // First, connect without synchronize to run manual migrations
  const preDs = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities: [],
    synchronize: false,
    logging: true,
  });

  await preDs.initialize();

  // Pre-migration: convert exercises enum columns to varchar if they exist as enums
  try {
    const hasExercisesTable = await preDs.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'exercises' LIMIT 1`
    );
    if (hasExercisesTable.length > 0) {
      // Check if "type" is still an enum
      const typeCol = await preDs.query(
        `SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'exercises' AND column_name = 'type'`
      );
      if (typeCol.length > 0 && typeCol[0].data_type === "USER-DEFINED") {
        console.log("Converting exercises.type from enum to varchar...");
        await preDs.query(`ALTER TABLE "exercises" ALTER COLUMN "type" TYPE varchar(100) USING "type"::text`);
        console.log("  done.");
      }

      // Check if "targetSkill" is still an enum
      const skillCol = await preDs.query(
        `SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'exercises' AND column_name = 'targetSkill'`
      );
      if (skillCol.length > 0 && skillCol[0].data_type === "USER-DEFINED") {
        console.log('Converting exercises.targetSkill from enum to varchar...');
        await preDs.query(`ALTER TABLE "exercises" ALTER COLUMN "targetSkill" TYPE varchar(100) USING "targetSkill"::text`);
        console.log("  done.");
      }
    }
  } catch (err) {
    console.warn("Pre-migration warning (non-fatal):", err);
  }

  await preDs.destroy();

  // Now run the full synchronize
  const ds = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities: [
      User,
      Academy,
      AcademyMember,
      Student,
      Room,
      RoomParticipant,
      RoomNotes,
      ChatMessage,
      Transcription,
      ClassReport,
      ExerciseTemplate,
      Exercise,
      UsageRecord,
    ],
    synchronize: true,
    logging: true,
  });

  await ds.initialize();
  console.log("Database synchronized successfully!");
  await ds.destroy();
}

main().catch((err) => {
  console.error("Failed to sync database:", err);
  process.exit(1);
});
