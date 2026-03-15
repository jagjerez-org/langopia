import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { entities } from "./entities/index.js";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        type: "postgres" as const,
        url: config.getOrThrow<string>("DATABASE_URL"),
        entities,
        migrations: ["dist/database/migrations/*.js"],
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
