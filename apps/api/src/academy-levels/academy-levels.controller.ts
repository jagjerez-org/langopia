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
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { User } from "../database/entities/user.entity.js";
import { AcademyLevelsService } from "./academy-levels.service.js";
import { CreateAcademyLevelDto } from "./dto/create-academy-level.dto.js";
import { UpdateAcademyLevelDto } from "./dto/update-academy-level.dto.js";

@ApiTags("Academy Levels")
@ApiBearerAuth()
@Controller("academies/:academyId/levels")
@UseGuards(JwtAuthGuard)
export class AcademyLevelsController {
  constructor(private readonly levelsService: AcademyLevelsService) {}

  @Get()
  @ApiOperation({ summary: "List all levels for an academy" })
  async list(@Param("academyId") academyId: string) {
    return this.levelsService.list(academyId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new level" })
  async create(
    @Param("academyId") academyId: string,
    @Body() dto: CreateAcademyLevelDto,
  ) {
    return this.levelsService.create(academyId, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a level" })
  async update(
    @Param("academyId") academyId: string,
    @Param("id") id: string,
    @Body() dto: UpdateAcademyLevelDto,
  ) {
    return this.levelsService.update(academyId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a level" })
  async remove(
    @Param("academyId") academyId: string,
    @Param("id") id: string,
  ) {
    await this.levelsService.remove(academyId, id);
  }
}
