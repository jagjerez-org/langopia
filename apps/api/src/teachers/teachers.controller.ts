import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ApiKeyGuard } from "../auth/guards/api-key.guard.js";
import { CurrentAcademy } from "../auth/decorators/current-academy.decorator.js";
import { Academy } from "../database/entities/academy.entity.js";
import { TeachersService } from "./teachers.service.js";
import { InviteTeacherDto } from "./dto/invite-teacher.dto.js";

@ApiTags("Teachers")
@ApiBearerAuth()
@Controller("v1/teachers")
@UseGuards(ApiKeyGuard)
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Get()
  @ApiOperation({ summary: "List academy teachers" })
  async listTeachers(@CurrentAcademy() academy: Academy) {
    return this.teachersService.listTeachers(academy.id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get teacher details with stats" })
  async getTeacher(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.teachersService.getTeacherDetail(academy.id, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Invite a teacher by email" })
  async inviteTeacher(
    @CurrentAcademy() academy: Academy,
    @Body() dto: InviteTeacherDto,
  ) {
    return this.teachersService.inviteTeacher(academy.id, academy.name, dto.email);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove a teacher (only if no classes assigned)" })
  async removeTeacher(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.teachersService.removeTeacher(academy.id, id);
  }

  @Patch(":id/deactivate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Deactivate a teacher (remove teacher role)" })
  async deactivateTeacher(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.teachersService.deactivateTeacher(academy.id, id);
  }

  @Patch(":id/reactivate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reactivate a teacher" })
  async reactivateTeacher(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.teachersService.reactivateTeacher(academy.id, id);
  }
}
