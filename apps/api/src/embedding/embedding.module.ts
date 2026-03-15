import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Exercise } from "../database/entities/exercise.entity.js";
import { EmbeddingService } from "./embedding.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([Exercise])],
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
