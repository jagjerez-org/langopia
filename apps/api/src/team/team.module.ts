import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TeamMember, User, InviteLink, Academy } from "../database/entities/index.js";
import { TeamController, TeamPublicController } from "./team.controller.js";
import { TeamService } from "./team.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([TeamMember, User, InviteLink, Academy])],
  controllers: [TeamController, TeamPublicController],
  providers: [TeamService],
  exports: [TeamService],
})
export class TeamModule {}
