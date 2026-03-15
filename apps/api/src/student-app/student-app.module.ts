import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import {
  User,
  Academy,
  Student,
  StudyStreak,
  DailyActivity,
  ReviewItem,
  LessonProgress,
  CourseProgress,
  StudentProgress,
  Class,
  ClassStudent,
  ClassReport,
  Course,
  CourseLesson,
  Exercise,
  LessonExercise,
  StudentLearningPath,
  StudentLearningPathCourse,
} from "../database/entities/index.js";
import { StudentAppService } from "./student-app.service.js";
import { StudentAuthController, StudentAppController } from "./student-app.controller.js";
import { StudentAuthGuard } from "./student-auth.guard.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Academy,
      Student,
      StudyStreak,
      DailyActivity,
      ReviewItem,
      LessonProgress,
      CourseProgress,
      StudentProgress,
      Class,
      ClassStudent,
      ClassReport,
      Course,
      CourseLesson,
      Exercise,
      LessonExercise,
      StudentLearningPath,
      StudentLearningPathCourse,
    ]),
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: { expiresIn: config.get("JWT_EXPIRATION", "6h") },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [StudentAuthController, StudentAppController],
  providers: [StudentAppService, StudentAuthGuard],
  exports: [StudentAppService],
})
export class StudentAppModule {}
