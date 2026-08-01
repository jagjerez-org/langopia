import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { Roles } from "../../../shared/infrastructure/http/roles.decorator.js";
import { CreateCourseCommand } from "../../application/commands/create-course/create-course.command.js";
import { CreateGroupCommand } from "../../application/commands/create-group/create-group.command.js";
import { EnrolStudentInGroupCommand } from "../../application/commands/enrol-student-in-group/enrol-student-in-group.command.js";
import { GetGroupQuery } from "../../application/queries/get-group/get-group.handler.js";
import { GetSchoolLocalesQuery } from "../../application/queries/get-school-locales/get-school-locales.handler.js";
import { ListCoursesQuery } from "../../application/queries/list-courses/list-courses.handler.js";
import { CreateCourseDto, CreateGroupDto, EnrolStudentDto } from "./dto/catalog.dto.js";

/**
 * Adaptador de ENTRADA sobre HTTP.
 *
 * Igual que `SchedulingController` y `StudentsController`: sin lógica de
 * negocio, solo traduce la petición a un comando o una consulta y la pone en
 * el bus.
 */
@Roles("owner", "admin")
@Controller()
export class CatalogController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  /**
   * Catálogo de la escuela activa, con sus grupos (Tarea 8 del panel web:
   * `CatalogController` solo tenía altas, ningún `GET`).
   */
  @Get("courses")
  async listCourses() {
    return this.queries.execute(new ListCoursesQuery());
  }

  /**
   * Idiomas soportados por la escuela activa: el alta de curso pinta un
   * campo de traducción por cada uno (Tarea 8 del panel web).
   */
  @Get("courses/locales")
  async schoolLocales() {
    return this.queries.execute(new GetSchoolLocalesQuery());
  }

  @Post("courses")
  async createCourse(@Body() dto: CreateCourseDto) {
    return this.commands.execute(
      new CreateCourseCommand({
        code: dto.code,
        language: dto.language,
        level: dto.level,
        modality: dto.modality,
        totalSessions: dto.totalSessions,
        sessionMinutes: dto.sessionMinutes,
        maxStudents: dto.maxStudents,
        priceCents: dto.priceCents,
        currency: dto.currency,
        translations: dto.translations,
      }),
    );
  }

  @Post("groups")
  async createGroup(@Body() dto: CreateGroupDto) {
    return this.commands.execute(
      new CreateGroupCommand({
        courseId: dto.courseId,
        teacherId: dto.teacherId ?? null,
        name: dto.name,
        startsOn: dto.startsOn,
        endsOn: dto.endsOn ?? null,
      }),
    );
  }

  @Post("groups/:id/enrolments")
  async enrol(@Param("id", ParseUUIDPipe) id: string, @Body() dto: EnrolStudentDto) {
    return this.commands.execute(
      new EnrolStudentInGroupCommand({
        groupId: id,
        studentId: dto.studentId,
        agreedPriceCents: dto.agreedPriceCents ?? null,
      }),
    );
  }

  /** Ficha de un grupo (Tarea 8 del panel web, Paso 3): curso, profesor, capacidad y fechas. */
  @Get("groups/:id")
  async getGroup(@Param("id", ParseUUIDPipe) id: string) {
    return this.queries.execute(new GetGroupQuery({ groupId: id }));
  }
}
