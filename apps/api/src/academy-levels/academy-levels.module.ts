import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AcademyLevel } from "../database/entities/index.js";
import { AcademyLevelsController } from "./academy-levels.controller.js";
import { AcademyLevelsService } from "./academy-levels.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([AcademyLevel])],
  controllers: [AcademyLevelsController],
  providers: [AcademyLevelsService],
  exports: [AcademyLevelsService],
})
export class AcademyLevelsModule {}
