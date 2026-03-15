import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ApiKeyGuard } from "../auth/guards/api-key.guard.js";
import { CurrentAcademy } from "../auth/decorators/current-academy.decorator.js";
import type { Academy } from "../database/entities/academy.entity.js";
import { ExercisesService } from "./exercises.service.js";
import { QueryExercisesDto } from "./dto/query-exercises.dto.js";
import { CreateExerciseDto } from "./dto/create-exercise.dto.js";
import { CreateSingleExerciseDto } from "./dto/create-single-exercise.dto.js";
import { UpdateExerciseDto } from "./dto/update-exercise.dto.js";
import { SearchExercisesDto } from "./dto/search-exercises.dto.js";
import { RegenerateExerciseDto } from "./dto/regenerate-exercise.dto.js";
import { AnalyzeExerciseDto } from "./dto/analyze-exercise.dto.js";
import { RefinePlanDto } from "./dto/refine-plan.dto.js";
import { PreviewExercisesDto } from "./dto/preview-exercises.dto.js";
import { RefinePreviewDto } from "./dto/refine-preview.dto.js";
import { BulkSaveExercisesDto } from "./dto/bulk-save-exercises.dto.js";

@ApiTags("exercises")
@ApiBearerAuth()
@Controller("v1/exercises")
@UseGuards(ApiKeyGuard)
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Get()
  @ApiOperation({ summary: "List exercises for the academy" })
  async list(
    @CurrentAcademy() academy: Academy,
    @Query() query: QueryExercisesDto,
  ) {
    return this.exercisesService.listExercises(academy.id, {
      source: query.source,
      language: query.language,
      cefrLevel: query.cefrLevel,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Generate exercises via AI" })
  async generate(
    @CurrentAcademy() academy: Academy,
    @Req() req: { ownerId: string },
    @Body() body: CreateExerciseDto,
  ) {
    return this.exercisesService.generateExercises(
      academy.id,
      req.ownerId,
      {
        topic: body.topic,
        language: body.language,
        cefrLevel: body.cefrLevel,
        materialContext: body.materialContext,
        mediaItemIds: body.mediaItemIds,
        lessonId: body.lessonId,
        exercises: body.exercises,
      },
    );
  }

  @Post("single")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a single exercise (prompt or manual)" })
  async createSingle(
    @CurrentAcademy() academy: Academy,
    @Req() req: { ownerId: string },
    @Body() body: CreateSingleExerciseDto,
  ) {
    return this.exercisesService.createSingleExercise(
      academy.id,
      req.ownerId,
      body,
    );
  }

  @Post("search")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Semantic vector search for exercises" })
  async search(
    @CurrentAcademy() academy: Academy,
    @Req() req: { ownerId: string },
    @Body() body: SearchExercisesDto,
  ) {
    return this.exercisesService.searchExercises(
      academy.id,
      req.ownerId,
      {
        query: body.query,
        limit: body.limit,
        language: body.language,
        cefrLevel: body.cefrLevel,
        targetSkill: body.targetSkill,
        excludeIds: body.excludeIds,
        mode: body.mode,
        distanceThreshold: body.distanceThreshold,
      },
    );
  }

  @Post("preview")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Preview exercises (analyze + generate, no DB save)" })
  async preview(
    @CurrentAcademy() academy: Academy,
    @Req() req: { ownerId: string },
    @Body() body: PreviewExercisesDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.exercisesService.previewExercises(
      academy.id,
      req.ownerId,
      {
        topic: body.topic,
        language: body.language,
        cefrLevel: body.cefrLevel,
        materialContext: body.materialContext,
        mediaItemIds: body.mediaItemIds,
        exercises: body.exercises,
      },
      file,
    );
  }

  @Post("preview/refine")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refine previewed exercises via chat" })
  async refinePreview(
    @CurrentAcademy() academy: Academy,
    @Req() req: { ownerId: string },
    @Body() body: RefinePreviewDto,
  ) {
    return this.exercisesService.refinePreview(
      academy.id,
      req.ownerId,
      {
        currentExercises: body.currentExercises,
        userMessage: body.userMessage,
        language: body.language,
        cefrLevel: body.cefrLevel,
        materialContext: body.materialContext,
        topic: body.topic,
      },
    );
  }

  @Post("bulk")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Bulk save previewed exercises to DB" })
  async bulkSave(
    @CurrentAcademy() academy: Academy,
    @Req() req: { ownerId: string },
    @Body() body: BulkSaveExercisesDto,
  ) {
    return this.exercisesService.bulkSaveExercises(
      academy.id,
      req.ownerId,
      {
        lessonId: body.lessonId,
        topic: body.topic,
        exercises: body.exercises,
      },
    );
  }

  @Post("analyze")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Analyze material and suggest exercise plan" })
  async analyze(
    @CurrentAcademy() academy: Academy,
    @Req() req: { ownerId: string },
    @Body() body: AnalyzeExerciseDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.exercisesService.analyzeMaterial(
      academy.id,
      req.ownerId,
      {
        topic: body.topic,
        language: body.language,
        cefrLevel: body.cefrLevel,
        materialContext: body.materialContext,
        mediaItemIds: body.mediaItemIds,
      },
      file,
    );
  }

  @Post("analyze/refine")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refine exercise plan via chat" })
  async refinePlan(
    @CurrentAcademy() academy: Academy,
    @Req() req: { ownerId: string },
    @Body() body: RefinePlanDto,
  ) {
    return this.exercisesService.refinePlan(
      academy.id,
      req.ownerId,
      {
        currentPlan: body.currentPlan,
        userMessage: body.userMessage,
        language: body.language,
        cefrLevel: body.cefrLevel,
        materialContext: body.materialContext,
        mediaItemIds: body.mediaItemIds,
      },
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get exercise details" })
  async getOne(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.exercisesService.getExercise(id, academy.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Edit exercise fields" })
  async update(
    @CurrentAcademy() academy: Academy,
    @Req() req: { ownerId: string },
    @Param("id") id: string,
    @Body() body: UpdateExerciseDto,
  ) {
    return this.exercisesService.updateExercise(
      id,
      academy.id,
      req.ownerId,
      body as Record<string, unknown>,
    );
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete exercise" })
  async remove(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.exercisesService.deleteExercise(id, academy.id);
  }

  @Put(":id")
  @ApiOperation({
    summary: "Regenerate exercise with AI (optional customPrompt)",
  })
  async regenerate(
    @CurrentAcademy() academy: Academy,
    @Req() req: { ownerId: string },
    @Param("id") id: string,
    @Body() body: RegenerateExerciseDto,
  ) {
    return this.exercisesService.regenerateExercise(
      id,
      academy.id,
      req.ownerId,
      body.customPrompt,
    );
  }
}
