import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LearningPath } from "../database/entities/learning-path.entity.js";
import { LearningPathLesson } from "../database/entities/learning-path-lesson.entity.js";
import { LearningPathCourse } from "../database/entities/learning-path-course.entity.js";
import { Lesson } from "../database/entities/lesson.entity.js";
import { Course } from "../database/entities/course.entity.js";
import { AuthModule } from "../auth/auth.module.js";
import { LearningPathsController } from "./learning-paths.controller.js";
import { LearningPathsService } from "./learning-paths.service.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([LearningPath, LearningPathLesson, LearningPathCourse, Lesson, Course]),
    AuthModule,
  ],
  controllers: [LearningPathsController],
  providers: [LearningPathsService],
  exports: [LearningPathsService],
})
export class LearningPathsModule {}
