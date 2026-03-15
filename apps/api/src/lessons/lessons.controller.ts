import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiQuery } from "@nestjs/swagger";
import { ApiKeyGuard } from "../auth/guards/api-key.guard.js";
import { CurrentAcademy } from "../auth/decorators/current-academy.decorator.js";
import { Academy } from "../database/entities/academy.entity.js";
import { LessonsService } from "./lessons.service.js";
import { CreateLessonDto } from "./dto/create-lesson.dto.js";
import { UpdateLessonDto } from "./dto/update-lesson.dto.js";
import { QueryLessonsDto } from "./dto/query-lessons.dto.js";
import { LinkExercisesDto } from "./dto/link-exercises.dto.js";

@ApiTags("Lessons")
@ApiBearerAuth()
@Controller("v1/lessons")
@UseGuards(ApiKeyGuard)
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get()
  @ApiOperation({ summary: "List lessons for the academy" })
  async listLessons(
    @CurrentAcademy() academy: Academy,
    @Query() query: QueryLessonsDto,
  ) {
    return this.lessonsService.listLessons(academy.id, {
      language: query.language,
      cefrLevel: query.cefrLevel,
      status: query.status,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new lesson" })
  async createLesson(
    @CurrentAcademy() academy: Academy,
    @Body() dto: CreateLessonDto,
  ) {
    return this.lessonsService.createLesson(academy.id, {
      title: dto.title,
      cefrLevel: dto.cefrLevel,
      language: dto.language,
      description: dto.description,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get lesson details" })
  async getLesson(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.lessonsService.getLessonDetail(academy.id, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a lesson" })
  async updateLesson(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.lessonsService.updateLesson(academy.id, id, {
      title: dto.title,
      description: dto.description,
      status: dto.status,
    });
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a lesson" })
  async deleteLesson(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    await this.lessonsService.deleteLesson(academy.id, id);
  }

  @Get(":id/exercises")
  @ApiOperation({ summary: "List exercises linked to this lesson" })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "offset", required: false })
  async listExercises(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
    @Query("limit") limitParam?: string,
    @Query("offset") offsetParam?: string,
  ) {
    const limit = Math.min(
      parseInt(limitParam ?? "100", 10),
      200,
    );
    const offset = parseInt(offsetParam ?? "0", 10);
    return this.lessonsService.listLessonExercises(academy.id, id, {
      limit,
      offset,
    });
  }

  @Post(":id/exercises")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Generate exercises for this lesson via AI" })
  @ApiConsumes("application/json", "multipart/form-data")
  @UseInterceptors(FilesInterceptor("file"))
  async generateExercises(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
    @Req() request: { ownerId: string; headers: Record<string, string>; body: Record<string, unknown> },
    @UploadedFiles() files?: Express.Multer.File[],
    @Body() body?: Record<string, unknown>,
  ) {
    const ownerId = request.ownerId;
    const contentType = request.headers["content-type"] ?? "";

    let topic: string | undefined;
    let exercises: { type: string; count: number }[] | undefined;
    let sourceContent: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      topic = (body?.topic as string) || undefined;
      const exercisesJson = body?.exercises as string | undefined;
      if (exercisesJson) {
        try {
          exercises = JSON.parse(exercisesJson);
        } catch {
          /* ignore */
        }
      }

      if (files && files.length > 0) {
        sourceContent = await this.lessonsService.extractTextFromFiles(
          files.map((f) => ({
            buffer: f.buffer,
            filename: f.originalname,
            mimeType: f.mimetype,
          })),
        );
      }
    } else {
      topic = body?.topic as string | undefined;
      exercises = body?.exercises as { type: string; count: number }[] | undefined;
    }

    if (!exercises || exercises.length === 0) {
      throw new BadRequestException("exercises array is required");
    }

    return this.lessonsService.generateExercises(academy.id, id, ownerId, {
      topic,
      exercises,
      sourceContent,
    });
  }

  @Patch(":id/exercises")
  @ApiOperation({ summary: "Link existing exercises to lesson" })
  async linkExercises(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
    @Body() dto: LinkExercisesDto,
  ) {
    return this.lessonsService.linkExercises(academy.id, id, dto.exerciseIds);
  }

  @Delete(":id/exercises")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Unlink an exercise from lesson" })
  @ApiQuery({ name: "exerciseId", required: true })
  async unlinkExercise(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
    @Query("exerciseId") exerciseId: string,
  ) {
    await this.lessonsService.unlinkExercise(academy.id, id, exerciseId);
  }

  // ─── Versions ──────────────────────────────────────────

  @Post(":id/versions")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Snapshot current lesson state as a new version" })
  async createVersion(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.lessonsService.createVersion(academy.id, id);
  }

  @Get(":id/versions")
  @ApiOperation({ summary: "List versions for a lesson" })
  async listVersions(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.lessonsService.listVersions(academy.id, id);
  }

  @Get(":id/versions/:vid")
  @ApiOperation({ summary: "Get version with full exercise snapshot" })
  async getVersion(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
    @Param("vid") vid: string,
  ) {
    return this.lessonsService.getVersion(academy.id, id, vid);
  }

  @Post(":id/versions/:vid/restore")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Restore lesson from a version snapshot" })
  async restoreVersion(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
    @Param("vid") vid: string,
  ) {
    return this.lessonsService.restoreVersion(academy.id, id, vid);
  }

  // ─── KPIs ──────────────────────────────────────────────

  @Get(":id/kpis")
  @ApiOperation({ summary: "Get aggregated lesson usage KPIs" })
  async getKpis(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.lessonsService.getLessonKpis(academy.id, id);
  }
}
