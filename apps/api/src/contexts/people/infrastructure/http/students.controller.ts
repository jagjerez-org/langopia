import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { Roles, RestrictedWhileImpersonating } from "../../../shared/infrastructure/http/roles.decorator.js";
import { EnrolStudentCommand } from "../../application/commands/enrol-student/enrol-student.command.js";
import { GrantConsentCommand } from "../../application/commands/grant-consent/grant-consent.command.js";
import { LeaveStudentCommand } from "../../application/commands/leave-student/leave-student.command.js";
import { UpdateStudentCommand } from "../../application/commands/update-student/update-student.command.js";
import { ListStudentsQuery } from "../../application/queries/list-students/list-students.handler.js";
import { EnrolStudentDto, GrantConsentDto, LeaveStudentDto, UpdateStudentDto } from "./dto/students.dto.js";

/**
 * Adaptador de ENTRADA sobre HTTP.
 *
 * Igual que `SchedulingController`: sin lógica de negocio, solo traduce la
 * petición a un comando o una consulta y la pone en el bus.
 */
@Roles("owner", "admin", "teacher")
@Controller("students")
export class StudentsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Roles("owner", "admin")
  @Post()
  async enrol(@Body() dto: EnrolStudentDto) {
    return this.commands.execute(
      new EnrolStudentCommand({
        name: dto.name,
        email: dto.email,
        dateOfBirth: dto.dateOfBirth,
        nativeLanguage: dto.nativeLanguage,
        targetLanguage: dto.targetLanguage,
        locale: dto.locale ?? null,
        currentLevel: dto.currentLevel ?? null,
        guardian: dto.guardian
          ? {
              name: dto.guardian.name,
              email: dto.guardian.email,
              relationship: dto.guardian.relationship,
            }
          : null,
      }),
    );
  }

  @Roles("owner", "admin")
  @Post(":id/leave")
  @HttpCode(200)
  async leave(@Param("id", ParseUUIDPipe) id: string, @Body() dto: LeaveStudentDto) {
    return this.commands.execute(new LeaveStudentCommand({ studentId: id, reason: dto.reason }));
  }

  /**
   * Tarea 17: otorgar un consentimiento queda fuera del soporte, aunque
   * quien impersona tenga el rol para hacerlo en circunstancias normales —
   * lo firma el tutor, nadie más, y menos alguien actuando en nombre de otra
   * persona.
   */
  @Roles("owner", "admin")
  @RestrictedWhileImpersonating("consent_management")
  @Post(":id/consents")
  @HttpCode(200)
  async grantConsent(@Param("id", ParseUUIDPipe) id: string, @Body() dto: GrantConsentDto) {
    return this.commands.execute(
      new GrantConsentCommand({
        studentId: id,
        kind: dto.kind,
        grantedByMembershipId: dto.grantedByMembershipId,
      }),
    );
  }

  /**
   * Edición de ficha (Tarea 13). `owner`/`admin` únicamente, igual que
   * `leave`/`consents`: la clase entera admite `teacher` para LEER (el
   * `list()` de abajo), pero modificar una ficha —incluida la de otro
   * profesor a través de `TeachersController`, que es enteramente
   * `owner`/`admin`— no es algo que el rol `teacher` pueda hacer por
   * defecto.
   */
  @Roles("owner", "admin")
  @Patch(":id")
  @HttpCode(200)
  async update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateStudentDto) {
    return this.commands.execute(
      new UpdateStudentCommand({
        studentId: id,
        dateOfBirth: dto.dateOfBirth,
        currentLevel: dto.currentLevel,
      }),
    );
  }

  @Get()
  async list() {
    return this.queries.execute(new ListStudentsQuery());
  }
}
