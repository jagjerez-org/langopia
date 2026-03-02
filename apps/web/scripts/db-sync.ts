import "reflect-metadata";
import { DataSource } from "typeorm";
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
  ExerciseTemplate,
  Exercise,
  LessonExercise,
  ReportExercise,
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
    console.warn("Pre-migration warning (exercises, non-fatal):", err);
  }

  // Pre-migration: convert academy_members.role enum → roles JSONB array
  try {
    const hasMembersTable = await preDs.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'academy_members' LIMIT 1`
    );
    if (hasMembersTable.length > 0) {
      // Check if old "role" column still exists
      const roleCol = await preDs.query(
        `SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'academy_members' AND column_name = 'role'`
      );
      if (roleCol.length > 0) {
        // Check if "roles" column already exists
        const rolesCol = await preDs.query(
          `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'academy_members' AND column_name = 'roles'`
        );
        if (rolesCol.length === 0) {
          console.log("Migrating academy_members.role → roles JSONB...");
          // First convert role to varchar if it's an enum
          if (roleCol[0].data_type === "USER-DEFINED") {
            await preDs.query(`ALTER TABLE "academy_members" ALTER COLUMN "role" TYPE varchar(50) USING "role"::text`);
          }
          // Add roles JSONB column
          await preDs.query(`ALTER TABLE "academy_members" ADD COLUMN "roles" jsonb DEFAULT '["teacher"]'`);
          // Migrate data: role → jsonb_build_array(role)
          await preDs.query(`UPDATE "academy_members" SET "roles" = jsonb_build_array("role")`);
          // Drop old role column
          await preDs.query(`ALTER TABLE "academy_members" DROP COLUMN "role"`);
          console.log("  done.");
        } else {
          // roles exists but role also exists — drop old role column
          console.log("Dropping legacy academy_members.role column...");
          await preDs.query(`ALTER TABLE "academy_members" DROP COLUMN "role"`);
          console.log("  done.");
        }
      }
    }
  } catch (err) {
    console.warn("Pre-migration warning (academy_members, non-fatal):", err);
  }

  // Pre-migration: drop lessons.topic column (merged with title)
  try {
    const hasTopicCol = await preDs.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'topic'`
    );
    if (hasTopicCol.length > 0) {
      console.log("Dropping lessons.topic column (merged with title)...");
      await preDs.query(`ALTER TABLE "lessons" DROP COLUMN "topic"`);
      console.log("  done.");
    }
  } catch (err) {
    console.warn("Pre-migration warning (lessons.topic, non-fatal):", err);
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
      ExerciseTemplate,
      Exercise,
      LessonExercise,
      ReportExercise,
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
