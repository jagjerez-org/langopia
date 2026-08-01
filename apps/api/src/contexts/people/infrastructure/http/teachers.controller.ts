import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { Roles } from "../../../shared/infrastructure/http/roles.decorator.js";
import { HireTeacherCommand } from "../../application/commands/hire-teacher/hire-teacher.command.js";
import { ReleaseTeacherCommand } from "../../application/commands/release-teacher/release-teacher.command.js";
import { SetAvailabilityCommand } from "../../application/commands/set-availability/set-availability.command.js";
import { UpdateTeacherCommand } from "../../application/commands/update-teacher/update-teacher.command.js";
import { ListTeachersQuery } from "../../application/queries/list-teachers/list-teachers.handler.js";
import {
  HireTeacherDto,
  ReleaseTeacherDto,
  SetAvailabilityDto,
  UpdateTeacherDto,
} from "./dto/teachers.dto.js";

/**
 * Adaptador de ENTRADA sobre HTTP.
 *
 * Igual que `StudentsController`: sin lógica de negocio, solo traduce la
 * petición a un comando o una consulta y la pone en el bus. Todo el
 * controlador sigue siendo `owner`/`admin` — a diferencia de `students`, aquí
 * no hay ninguna ruta que un profesor necesite consultar sobre sí mismo, ni
 * siquiera el listado (Tarea 8 del panel web: gestión de plantilla, no
 * autoconsulta).
 */
@Roles("owner", "admin")
@Controller("teachers")
export class TeachersController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  /**
   * Directorio de profesorado (Tarea 8 del panel web). No existía ningún
   * `GET /teachers`: la Tarea 7 (Alumnado) tuvo que dejar la valoración de
   * progreso con un campo de texto libre para el identificador del profesor
   * por esa misma razón — ver su informe, «Decisión 2».
   */
  @Get()
  async list() {
    return this.queries.execute(new ListTeachersQuery());
  }

  @Post()
  async hire(@Body() dto: HireTeacherDto) {
    return this.commands.execute(
      new HireTeacherCommand({
        name: dto.name,
        email: dto.email,
        tier: dto.tier,
        hourlyRateCents: dto.hourlyRateCents,
        contractedHoursPerWeek: dto.contractedHoursPerWeek,
        hiredAt: dto.hiredAt,
        locale: dto.locale ?? null,
      }),
    );
  }

  @Put(":id/availability")
  @HttpCode(200)
  async setAvailability(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SetAvailabilityDto) {
    return this.commands.execute(
      new SetAvailabilityCommand({ teacherId: id, slots: dto.slots }),
    );
  }

  /** Edición de ficha (Tarea 13): tramo y/o tarifa. Hereda `owner`/`admin` de la clase. */
  @Patch(":id")
  @HttpCode(200)
  async update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateTeacherDto) {
    return this.commands.execute(
      new UpdateTeacherCommand({ teacherId: id, tier: dto.tier, hourlyRateCents: dto.hourlyRateCents }),
    );
  }

  /**
   * No está en la tabla de endpoints del brief, que solo lista alta y
   * disponibilidad — pero sí pide explícitamente crear el comando
   * `release-teacher`, y un comando sin ninguna vía HTTP para invocarlo no
   * sirve de nada. Sigue la forma de `POST /students/:id/leave`.
   */
  @Post(":id/release")
  @HttpCode(200)
  async release(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ReleaseTeacherDto) {
    return this.commands.execute(new ReleaseTeacherCommand({ teacherId: id, reason: dto.reason }));
  }
}
