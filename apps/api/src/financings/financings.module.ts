import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StudentSubscription, AcademyPlan, Student } from "../database/entities/index.js";
import { FinancingsController } from "./financings.controller.js";
import { FinancingsService } from "./financings.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([StudentSubscription, AcademyPlan, Student])],
  controllers: [FinancingsController],
  providers: [FinancingsService],
  exports: [FinancingsService],
})
export class FinancingsModule {}
