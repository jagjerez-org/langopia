import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AcademyPlan, StudentSubscription, Academy } from "../database/entities/index.js";
import { AcademyPlansController } from "./academy-plans.controller.js";
import { AcademyPlansService } from "./academy-plans.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([AcademyPlan, StudentSubscription, Academy])],
  controllers: [AcademyPlansController],
  providers: [AcademyPlansService],
  exports: [AcademyPlansService],
})
export class AcademyPlansModule {}
