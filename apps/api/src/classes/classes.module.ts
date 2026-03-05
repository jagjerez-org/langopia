import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Class } from "../database/entities/class.entity.js";
import { ClassStudent } from "../database/entities/class-student.entity.js";
import { AcademyMember } from "../database/entities/academy-member.entity.js";
import { Student } from "../database/entities/student.entity.js";
import { Lesson } from "../database/entities/lesson.entity.js";
import { User } from "../database/entities/user.entity.js";
import { AuthModule } from "../auth/auth.module.js";
import { UsageModule } from "../usage/usage.module.js";
import { EmailModule } from "../email/email.module.js";
import { PushNotificationModule } from "../push-notification/push-notification.module.js";
import { ClassesController } from "./classes.controller.js";
import { ClassesService } from "./classes.service.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Class,
      ClassStudent,
      AcademyMember,
      Student,
      Lesson,
      User,
    ]),
    AuthModule,
    UsageModule,
    EmailModule,
    PushNotificationModule,
  ],
  controllers: [ClassesController],
  providers: [ClassesService],
  exports: [ClassesService],
})
export class ClassesModule {}
