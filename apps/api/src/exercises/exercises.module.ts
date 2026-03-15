import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Exercise } from "../database/entities/exercise.entity.js";
import { Lesson } from "../database/entities/lesson.entity.js";
import { LessonExercise } from "../database/entities/lesson-exercise.entity.js";
import { User } from "../database/entities/user.entity.js";
import { MediaItem } from "../database/entities/media-item.entity.js";
import { AuthModule } from "../auth/auth.module.js";
import { UsageModule } from "../usage/usage.module.js";
import { EmbeddingModule } from "../embedding/embedding.module.js";
import { TTSModule } from "../tts/tts.module.js";
import { FileExtractModule } from "../file-extract/file-extract.module.js";
import { MediaProcessingModule } from "../media-processing/media-processing.module.js";
import { ExercisesService } from "./exercises.service.js";
import { ExercisesController } from "./exercises.controller.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([Exercise, Lesson, LessonExercise, User, MediaItem]),
    AuthModule,
    UsageModule,
    EmbeddingModule,
    TTSModule,
    FileExtractModule,
    MediaProcessingModule,
  ],
  controllers: [ExercisesController],
  providers: [ExercisesService],
  exports: [ExercisesService],
})
export class ExercisesModule {}
