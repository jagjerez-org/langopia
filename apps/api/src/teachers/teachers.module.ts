import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Teacher } from "../database/entities/teacher.entity.js";
import { User } from "../database/entities/user.entity.js";
import { Class } from "../database/entities/class.entity.js";
import { ClassStudent } from "../database/entities/class-student.entity.js";
import { Student } from "../database/entities/student.entity.js";
import { ClassReport } from "../database/entities/class-report.entity.js";
import { AuthModule } from "../auth/auth.module.js";
import { EmailModule } from "../email/email.module.js";
import { TeachersController } from "./teachers.controller.js";
import { TeachersService } from "./teachers.service.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([Teacher, User, Class, ClassStudent, Student, ClassReport]),
    AuthModule,
    EmailModule,
  ],
  controllers: [TeachersController],
  providers: [TeachersService],
  exports: [TeachersService],
})
export class TeachersModule {}
