import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { ApiKeyGuard } from "../auth/guards/api-key.guard.js";
import { CurrentAcademy } from "../auth/decorators/current-academy.decorator.js";
import { Academy } from "../database/entities/academy.entity.js";
import { LearningPathsService } from "./learning-paths.service.js";
import { CreateLearningPathDto } from "./dto/create-learning-path.dto.js";
import { UpdateLearningPathDto } from "./dto/update-learning-path.dto.js";
import { QueryLearningPathsDto } from "./dto/query-learning-paths.dto.js";
import { AddLessonsDto } from "./dto/manage-lessons.dto.js";
import { ReorderLessonsDto } from "./dto/manage-lessons.dto.js";

@ApiTags("Learning Paths")
@ApiBearerAuth()
@Controller("v1/learning-paths")
@UseGuards(ApiKeyGuard)
export class LearningPathsController {
  constructor(
    private readonly learningPathsService: LearningPathsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List learning paths with lesson counts" })
  async listLearningPaths(
    @CurrentAcademy() academy: Academy,
    @Query() query: QueryLearningPathsDto,
  ) {
    return this.learningPathsService.listLearningPaths(academy.id, {
      language: query.language,
      cefrLevel: query.cefrLevel,
      status: query.status,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new learning path" })
  async createLearningPath(
    @CurrentAcademy() academy: Academy,
    @Body() dto: CreateLearningPathDto,
  ) {
    return this.learningPathsService.createLearningPath(academy.id, {
      title: dto.title,
      cefrLevel: dto.cefrLevel,
      language: dto.language,
      description: dto.description,
      thumbnailUrl: dto.thumbnailUrl,
      estimatedHours: dto.estimatedHours,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get learning path detail with lessons" })
  async getLearningPath(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.learningPathsService.getLearningPathDetail(academy.id, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a learning path" })
  async updateLearningPath(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
    @Body() dto: UpdateLearningPathDto,
  ) {
    return this.learningPathsService.updateLearningPath(academy.id, id, {
      title: dto.title,
      description: dto.description,
      language: dto.language,
      cefrLevel: dto.cefrLevel,
      thumbnailUrl: dto.thumbnailUrl,
      estimatedHours: dto.estimatedHours,
      status: dto.status,
    });
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a learning path" })
  async deleteLearningPath(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    await this.learningPathsService.deleteLearningPath(academy.id, id);
  }

  @Get(":id/lessons")
  @ApiOperation({ summary: "List lessons in this learning path (ordered by sortOrder)" })
  async listLessons(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.learningPathsService.listLessons(academy.id, id);
  }

  @Post(":id/lessons")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Add lessons to learning path" })
  async addLessons(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
    @Body() dto: AddLessonsDto,
  ) {
    return this.learningPathsService.addLessons(
      academy.id,
      id,
      dto.lessonId,
      dto.lessonIds,
    );
  }

  @Patch(":id/lessons")
  @ApiOperation({ summary: "Reorder lessons in learning path" })
  async reorderLessons(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
    @Body() dto: ReorderLessonsDto,
  ) {
    return this.learningPathsService.reorderLessons(
      academy.id,
      id,
      dto.lessonIds,
    );
  }

  @Delete(":id/lessons")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove a lesson from learning path" })
  @ApiQuery({ name: "lessonId", required: true })
  async removeLesson(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
    @Query("lessonId") lessonId: string,
  ) {
    await this.learningPathsService.removeLesson(academy.id, id, lessonId);
  }
}
