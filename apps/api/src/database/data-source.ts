import "reflect-metadata";
import { DataSource } from "typeorm";
import { entities } from "./entities/index.js";

export default new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities,
  migrations: ["src/database/migrations/*.ts"],
  synchronize: false,
  logging: process.env.NODE_ENV === "development",
});
