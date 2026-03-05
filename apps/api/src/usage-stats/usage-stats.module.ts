import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../database/entities/user.entity.js";
import { UsageRecord } from "../database/entities/usage-record.entity.js";
import { AuthModule } from "../auth/auth.module.js";
import { UsageStatsController } from "./usage-stats.controller.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UsageRecord]),
    AuthModule,
  ],
  controllers: [UsageStatsController],
})
export class UsageStatsModule {}
