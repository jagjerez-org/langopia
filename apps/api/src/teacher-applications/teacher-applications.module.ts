import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TeacherApplication, ApplicationCustomField, Academy } from "../database/entities/index.js";
import { TeacherApplicationsController } from "./teacher-applications.controller.js";
import { TeacherApplicationsService } from "./teacher-applications.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([TeacherApplication, ApplicationCustomField, Academy])],
  controllers: [TeacherApplicationsController],
  providers: [TeacherApplicationsService],
  exports: [TeacherApplicationsService],
})
export class TeacherApplicationsModule {}
