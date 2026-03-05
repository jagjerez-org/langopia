import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AcademyMember } from "../database/entities/academy-member.entity.js";
import { User } from "../database/entities/user.entity.js";
import { AuthModule } from "../auth/auth.module.js";
import { TeachersController } from "./teachers.controller.js";
import { TeachersService } from "./teachers.service.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([AcademyMember, User]),
    AuthModule,
  ],
  controllers: [TeachersController],
  providers: [TeachersService],
  exports: [TeachersService],
})
export class TeachersModule {}
