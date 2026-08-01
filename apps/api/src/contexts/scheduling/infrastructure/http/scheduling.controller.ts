import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { Roles } from "../../../shared/infrastructure/http/roles.decorator.js";
import { CancelClassSessionCommand } from "../../application/commands/cancel-class-session/cancel-class-session.command.js";
import { ImportAttendanceCommand } from "../../application/commands/import-attendance/import-attendance.command.js";
import { RecordAttendanceCommand } from "../../application/commands/record-attendance/record-attendance.command.js";
import { RescheduleClassSessionCommand } from "../../application/commands/reschedule-class-session/reschedule-class-session.command.js";
import { ScheduleClassSessionCommand } from "../../application/commands/schedule-class-session/schedule-class-session.command.js";
import { GetCancellationPreviewQuery } from "../../application/queries/get-cancellation-preview/get-cancellation-preview.handler.js";
import { GetGroupRosterQuery } from "../../application/queries/get-group-roster/get-group-roster.handler.js";
import { GetSchoolTimezoneQuery } from "../../application/queries/get-school-timezone/get-school-timezone.handler.js";
import { GetTeacherOccupancyQuery } from "../../application/queries/get-teacher-occupancy/get-teacher-occupancy.handler.js";
import { GetWeeklyAgendaQuery } from "../../application/queries/get-weekly-agenda/get-weekly-agenda.handler.js";
import {
  AgendaRangeDto,
  CancellationPreviewQueryDto,
  CancelClassSessionDto,
  DateRangeDto,
  ImportAttendanceDto,
  RecordAttendanceDto,
  RescheduleClassSessionDto,
  ScheduleClassSessionDto,
} from "./dto/scheduling.dto.js";

/**
 * Adaptador de ENTRADA sobre HTTP.
 *
 * Un controlador aquí no tiene lógica: traduce la petición a un comando o una
 * consulta, lo pone en el bus y devuelve el resultado. Si algún día aparece
 * un `if` de negocio en este fichero, está en el sitio equivocado.
 *
 * Esa delgadez es lo que permite que el servidor MCP (módulo 8) sea otro
 * adaptador de entrada sobre los MISMOS comandos, sin reimplementar nada:
 * cancelar una clase desde Claude y desde el panel recorren exactamente el
 * mismo camino y aplican exactamente las mismas reglas.
 */
@Roles("owner", "admin", "teacher")
@Controller("scheduling")
export class SchedulingController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Roles("owner", "admin")
  @Post("sessions")
  async schedule(@Body() dto: ScheduleClassSessionDto) {
    return this.commands.execute(
      new ScheduleClassSessionCommand({
        groupId: dto.groupId,
        teacherId: dto.teacherId ?? null,
        startsAt: dto.startsAt,
        durationMinutes: dto.durationMinutes,
        roomProvider: dto.roomProvider,
        roomUrl: dto.roomUrl ?? null,
        roomExternalId: dto.roomExternalId ?? null,
        topic: dto.topic ?? null,
        contentUnitId: dto.contentUnitId ?? null,
        overrideAvailability: dto.overrideAvailability ?? false,
      }),
    );
  }

  @Roles("owner", "admin")
  @Post("sessions/:id/cancel")
  @HttpCode(200)
  async cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CancelClassSessionDto,
  ) {
    return this.commands.execute(
      new CancelClassSessionCommand({ sessionId: id, party: dto.party, reason: dto.reason }),
    );
  }

  /**
   * Adelanto de si `cancel` generaría devolución, sin cancelar nada (Tarea 9
   * del panel, Paso 3): el panel muestra este dato ANTES de confirmar, y no
   * lo calcula él mismo — ver `GetCancellationPreviewHandler`.
   */
  @Roles("owner", "admin")
  @Get("sessions/:id/cancellation-preview")
  async cancellationPreview(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: CancellationPreviewQueryDto,
  ) {
    return this.queries.execute(
      new GetCancellationPreviewQuery({ sessionId: id, party: query.party }),
    );
  }

  @Roles("owner", "admin")
  @Post("sessions/:id/reschedule")
  @HttpCode(200)
  async reschedule(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RescheduleClassSessionDto,
  ) {
    return this.commands.execute(
      new RescheduleClassSessionCommand({
        sessionId: id,
        newStartsAt: dto.newStartsAt,
        reason: dto.reason,
        newTeacherId: dto.newTeacherId,
        overrideAvailability: dto.overrideAvailability ?? false,
      }),
    );
  }

  /**
   * Pasar lista. Sin `@Roles` propio: hereda los del controlador
   * (owner/admin/teacher) porque es la tarea rutinaria del profesorado
   * después de su propia clase, no una acción de dirección.
   */
  @Post("sessions/:id/attendance")
  @HttpCode(200)
  async recordAttendance(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RecordAttendanceDto,
  ) {
    return this.commands.execute(
      new RecordAttendanceCommand({
        sessionId: id,
        entries: dto.entries.map((entry) => ({
          studentId: entry.studentId,
          status: entry.status,
          note: entry.note ?? null,
        })),
      }),
    );
  }

  @Roles("owner", "admin")
  @Post("sessions/:id/attendance/import")
  @HttpCode(200)
  async importAttendance(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ImportAttendanceDto,
  ) {
    return this.commands.execute(
      new ImportAttendanceCommand({
        sessionId: id,
        entries: dto.entries.map((entry) => ({
          studentId: entry.studentId,
          status: entry.status,
          joinedAt: entry.joinedAt ?? null,
          leftAt: entry.leftAt ?? null,
          minutesPresent: entry.minutesPresent ?? null,
        })),
      }),
    );
  }

  @Get("agenda")
  async agenda(@Query() query: AgendaRangeDto) {
    return this.queries.execute(
      new GetWeeklyAgendaQuery({
        from: query.from,
        to: query.to,
        teacherId: query.teacherId,
        groupId: query.groupId,
      }),
    );
  }

  @Get("teacher-occupancy")
  async occupancy(@Query() range: DateRangeDto) {
    return this.queries.execute(new GetTeacherOccupancyQuery(range));
  }

  /**
   * Zona horaria de la escuela activa (Tarea 9 del panel): el calendario
   * pinta cada clase en esta zona, nunca en la del navegador.
   *
   * `@Roles` propio (Tarea 11 del panel: portal del alumno y aula del
   * profesor): un dato sin nada sensible —una cadena de zona horaria, la
   * misma para toda la escuela— que el portal del alumno necesita exactamente
   * por el mismo motivo que el calendario, así que se abre a los cinco roles
   * en vez de heredar el `owner`/`admin`/`teacher` de la clase, pensado para
   * las rutas de gestión que sí son solo de personal.
   */
  @Roles("owner", "admin", "teacher", "student", "guardian")
  @Get("school-timezone")
  async schoolTimezone() {
    return this.queries.execute(new GetSchoolTimezoneQuery());
  }

  /** Padrón de un grupo, con nombre — para pasar lista desde el calendario (Tarea 9, Paso 6). */
  @Get("groups/:groupId/roster")
  async roster(@Param("groupId", ParseUUIDPipe) groupId: string) {
    return this.queries.execute(new GetGroupRosterQuery({ groupId }));
  }
}
