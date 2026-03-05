import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsageRecord } from "../database/entities/usage-record.entity.js";
import { User } from "../database/entities/user.entity.js";
import { UsageService } from "./usage.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([UsageRecord, User])],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
