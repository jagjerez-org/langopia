import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AcademyMember } from "../database/entities/academy-member.entity.js";
import { Room } from "../database/entities/room.entity.js";
import { ClassReport } from "../database/entities/class-report.entity.js";
import { UsageRecord } from "../database/entities/usage-record.entity.js";
import { AuthModule } from "../auth/auth.module.js";
import { DashboardController } from "./dashboard.controller.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([AcademyMember, Room, ClassReport, UsageRecord]),
    AuthModule,
  ],
  controllers: [DashboardController],
})
export class DashboardModule {}
