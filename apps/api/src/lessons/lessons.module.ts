import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Lesson } from "../database/entities/lesson.entity.js";
import { LessonExercise } from "../database/entities/lesson-exercise.entity.js";
import { LessonVersion } from "../database/entities/lesson-version.entity.js";
import { Exercise } from "../database/entities/exercise.entity.js";
import { User } from "../database/entities/user.entity.js";
import { CourseLesson } from "../database/entities/course-lesson.entity.js";
import { LearningPathLesson } from "../database/entities/learning-path-lesson.entity.js";
import { AuthModule } from "../auth/auth.module.js";
import { EmbeddingModule } from "../embedding/embedding.module.js";
import { TTSModule } from "../tts/tts.module.js";
import { FileExtractModule } from "../file-extract/file-extract.module.js";
import { UsageModule } from "../usage/usage.module.js";
import { LessonsController } from "./lessons.controller.js";
import { LessonsService } from "./lessons.service.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([Lesson, LessonExercise, LessonVersion, Exercise, User, CourseLesson, LearningPathLesson]),
    AuthModule,
    EmbeddingModule,
    TTSModule,
    FileExtractModule,
    UsageModule,
  ],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
