import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { User } from "../database/entities/index.js";
import { TeamService } from "./team.service.js";
import { InviteTeamMemberDto } from "./dto/invite-team-member.dto.js";
import { UpdateTeamMemberDto } from "./dto/update-team-member.dto.js";
import { CreateInviteLinkDto } from "./dto/create-invite-link.dto.js";
import { JoinViaInviteDto } from "./dto/join-via-invite.dto.js";

@ApiTags("Team")
@ApiBearerAuth()
@Controller("academies/:academyId/team")
@UseGuards(JwtAuthGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  @ApiOperation({ summary: "List team members" })
  async listMembers(
    @CurrentUser() user: User,
    @Param("academyId") academyId: string,
  ) {
    return this.teamService.list(academyId);
  }

  @Post("invite")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Invite team member by email" })
  async inviteMember(
    @CurrentUser() user: User,
    @Param("academyId") academyId: string,
    @Body() dto: InviteTeamMemberDto,
  ) {
    return this.teamService.invite(academyId, dto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get team member detail" })
  async getMember(
    @CurrentUser() user: User,
    @Param("academyId") academyId: string,
    @Param("id") id: string,
  ) {
    return this.teamService.findOne(academyId, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update team member role/permissions/status" })
  async updateMember(
    @CurrentUser() user: User,
    @Param("academyId") academyId: string,
    @Param("id") id: string,
    @Body() dto: UpdateTeamMemberDto,
  ) {
    return this.teamService.update(academyId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove team member" })
  async removeMember(
    @CurrentUser() user: User,
    @Param("academyId") academyId: string,
    @Param("id") id: string,
  ) {
    return this.teamService.remove(academyId, id);
  }

  @Post("invite-links")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create invite link" })
  async createInviteLink(
    @CurrentUser() user: User,
    @Param("academyId") academyId: string,
    @Body() dto: CreateInviteLinkDto,
  ) {
    return this.teamService.createInviteLink(academyId, dto);
  }

  @Get("invite-links")
  @ApiOperation({ summary: "List active invite links" })
  async listInviteLinks(
    @CurrentUser() user: User,
    @Param("academyId") academyId: string,
  ) {
    return this.teamService.listInviteLinks(academyId);
  }

  @Delete("invite-links/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Deactivate invite link" })
  async deactivateInviteLink(
    @CurrentUser() user: User,
    @Param("academyId") academyId: string,
    @Param("id") id: string,
  ) {
    return this.teamService.deactivateInviteLink(academyId, id);
  }
}

// Separate controller for the public endpoint (no auth guard)
@ApiTags("Team")
@Controller("academies/public/invite")
export class TeamPublicController {
  constructor(private readonly teamService: TeamService) {}

  @Post(":token")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Join academy via invite link" })
  async joinViaInvite(
    @Param("token") token: string,
    @Body() dto: JoinViaInviteDto,
  ) {
    return this.teamService.joinViaInvite(token, dto);
  }
}
