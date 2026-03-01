import "reflect-metadata";
import { DataSource } from "typeorm";
import {
  Academy,
  User,
  Classroom,
  ClassroomEnrollment,
  Session,
  Transcription,
  ClassReport,
  LearningProfile,
  ProgressReport,
} from "@/entities";

const entities = [
  Academy,
  User,
  Classroom,
  ClassroomEnrollment,
  Session,
  Transcription,
  ClassReport,
  LearningProfile,
  ProgressReport,
];

let dataSource: DataSource | null = null;

export function createDataSource(): DataSource {
  return new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities,
    synchronize: process.env.NODE_ENV === "development",
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
