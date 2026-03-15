import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CurrentAcademy } from "../auth/decorators/current-academy.decorator.js";
import { Academy } from "../database/entities/index.js";
import { CoursesService } from "./courses.service.js";
import { CreateCourseDto } from "./dto/create-course.dto.js";
import { UpdateCourseDto } from "./dto/update-course.dto.js";
import { QueryCoursesDto } from "./dto/query-courses.dto.js";
import { ManageCourseLessonsDto } from "./dto/manage-course-lessons.dto.js";
import { GenerateCourseDto } from "./dto/generate-course.dto.js";
import { RefineCourseDto } from "./dto/refine-course.dto.js";

@ApiTags("Courses")
@ApiBearerAuth()
@Controller("academies/:academyId/courses")
@UseGuards(JwtAuthGuard)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @ApiOperation({ summary: "List courses with filters" })
  async list(
    @CurrentAcademy() academy: Academy,
    @Query() query: QueryCoursesDto,
  ) {
    return this.coursesService.list(academy.id, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a course" })
  async create(
    @CurrentAcademy() academy: Academy,
    @Body() dto: CreateCourseDto,
  ) {
    return this.coursesService.create(academy.id, dto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get course with lessons" })
  async findOne(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.coursesService.findOne(academy.id, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a course" })
  async update(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.coursesService.update(academy.id, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a course (cascades course_lessons)" })
  async remove(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    await this.coursesService.remove(academy.id, id);
  }

  @Put(":id/lessons")
  @ApiOperation({ summary: "Replace all course lessons" })
  async setLessons(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
    @Body() dto: ManageCourseLessonsDto,
  ) {
    return this.coursesService.setLessons(academy.id, id, dto);
  }

  @Post("generate")
  @ApiOperation({ summary: "Generate course plan with AI" })
  async generate(
    @CurrentAcademy() academy: Academy,
    @Req() req: { ownerId: string },
    @Body() dto: GenerateCourseDto,
  ) {
    return this.coursesService.generate(academy.id, req.ownerId, dto);
  }

  @Post("generate/refine")
  @ApiOperation({ summary: "Refine course plan via chat" })
  async refinePlan(
    @CurrentAcademy() academy: Academy,
    @Req() req: { ownerId: string },
    @Body() dto: RefineCourseDto,
  ) {
    return this.coursesService.refinePlan(academy.id, req.ownerId, dto);
  }
}
