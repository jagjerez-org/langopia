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
} from "@/entities";

const entities = [
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
];

let dataSource: DataSource | null = null;

export function createDataSource(): DataSource {
  return new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities,
    synchronize: false,
    logging: process.env.NODE_ENV === "development",
    migrations: ["src/migrations/*.ts"],
  });
}

export async function getDataSource(): Promise<DataSource> {
  if (dataSource && dataSource.isInitialized) {
    return dataSource;
  }

  dataSource = createDataSource();
  await dataSource.initialize();
  return dataSource;
}
