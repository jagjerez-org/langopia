import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Academy } from "../database/entities/academy.entity.js";
import { AcademyMember } from "../database/entities/academy-member.entity.js";
import { User } from "../database/entities/user.entity.js";
import { AuthModule } from "../auth/auth.module.js";
import { PermissionsModule } from "../permissions/permissions.module.js";
import { AcademiesController } from "./academies.controller.js";
import { AcademiesService } from "./academies.service.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([Academy, AcademyMember, User]),
    AuthModule,
    PermissionsModule,
  ],
  controllers: [AcademiesController],
  providers: [AcademiesService],
  exports: [AcademiesService],
})
export class AcademiesModule {}
