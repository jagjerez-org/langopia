import { Controller, Get, Patch, Param, Query, UseGuards, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ApiKeyGuard } from "../auth/guards/api-key.guard.js";
import { CurrentAcademy } from "../auth/decorators/current-academy.decorator.js";
import { Academy } from "../database/entities/academy.entity.js";
import { StudentsService } from "./students.service.js";
import { QueryStudentsDto } from "./dto/query-students.dto.js";

@ApiTags("Students")
@ApiBearerAuth()
@Controller("v1/students")
@UseGuards(ApiKeyGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @ApiOperation({ summary: "List students for the academy" })
  async listStudents(
    @CurrentAcademy() academy: Academy,
    @Query() query: QueryStudentsDto,
  ) {
    return this.studentsService.listStudents(academy.id, {
      search: query.search,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
      includeInactive: query.includeInactive === "true",
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get student details with participation history" })
  async getStudent(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.studentsService.getStudentDetail(academy.id, id);
  }

  @Patch(":id/deactivate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Deactivate a student (soft delete)" })
  async deactivateStudent(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.studentsService.setActive(academy.id, id, false);
  }

  @Patch(":id/activate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reactivate a student" })
  async activateStudent(
    @CurrentAcademy() academy: Academy,
    @Param("id") id: string,
  ) {
    return this.studentsService.setActive(academy.id, id, true);
  }
}
