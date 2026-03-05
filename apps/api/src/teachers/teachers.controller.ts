import {
  Controller,
  Get,
  Post,
  Body,
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

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Invite a teacher by email" })
  async inviteTeacher(
    @CurrentAcademy() academy: Academy,
    @Body() dto: InviteTeacherDto,
  ) {
    return this.teachersService.inviteTeacher(academy.id, dto.email);
  }
}
