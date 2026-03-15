import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module.js";
import {
  AcademyMember,
  Class,
  ClassStudent,
  ClassReport,
  Exercise,
  Lesson,
  LessonExercise,
  Notification,
  Student,
  Teacher,
} from "../database/entities/index.js";
import { MeController } from "./me.controller.js";
import { MeService } from "./me.service.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AcademyMember,
      Class,
      ClassStudent,
      ClassReport,
      Exercise,
      Lesson,
      LessonExercise,
      Notification,
      Student,
      Teacher,
    ]),
    AuthModule,
  ],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
