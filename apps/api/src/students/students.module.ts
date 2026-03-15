import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Student } from "../database/entities/student.entity.js";
import { RoomParticipant } from "../database/entities/room-participant.entity.js";
import { ReportExercise } from "../database/entities/report-exercise.entity.js";
import { Class } from "../database/entities/class.entity.js";
import { ClassStudent } from "../database/entities/class-student.entity.js";
import { ClassReport } from "../database/entities/class-report.entity.js";
import { StudentSubscription } from "../database/entities/student-subscription.entity.js";
import { StudyStreak } from "../database/entities/study-streak.entity.js";
import { DailyActivity } from "../database/entities/daily-activity.entity.js";
import { AuthModule } from "../auth/auth.module.js";
import { StudentsController } from "./students.controller.js";
import { StudentsService } from "./students.service.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Student, RoomParticipant, ReportExercise, Class, ClassStudent,
      ClassReport, StudentSubscription, StudyStreak, DailyActivity,
    ]),
    AuthModule,
  ],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
