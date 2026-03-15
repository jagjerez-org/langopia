import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Course, CourseLesson, Lesson, LearningPathCourse, User } from "../database/entities/index.js";
import { UsageModule } from "../usage/usage.module.js";
import { CoursesController } from "./courses.controller.js";
import { CoursesService } from "./courses.service.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([Course, CourseLesson, Lesson, LearningPathCourse, User]),
    UsageModule,
  ],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
