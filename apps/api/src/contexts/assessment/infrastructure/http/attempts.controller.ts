import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { Roles } from "../../../shared/infrastructure/http/roles.decorator.js";
import { ReturnAttemptCommand } from "../../application/commands/return-attempt/return-attempt.command.js";
import { SubmitAttemptCommand } from "../../application/commands/submit-attempt/submit-attempt.command.js";
import { ValidateAttemptCommand } from "../../application/commands/validate-attempt/validate-attempt.command.js";
import { GetPendingAttemptsQuery } from "../../application/queries/get-pending-attempts/get-pending-attempts.handler.js";
import { ReturnAttemptDto, SubmitAttemptDto, ValidateAttemptDto } from "./dto/assessment.dto.js";

/**
 * Adaptador de ENTRADA sobre HTTP.
 *
 * Sin lógica de negocio: traduce la petición a un comando y lo pone en el
 * bus. `owner`/`admin`/`teacher` para validar, devolver y ver la bandeja:
 * firmar una nota y decidir qué pasa con la corrección de otro son, por
 * regla de la ola, cosa exclusiva del profesorado.
 *
 * `submit` (tarea 12 de la ola 2: «hacer ejercicios») abre también a
 * `student`/`guardian` — el autoservicio del alumno que el comentario
 * original de esta tarea (7) dejó anotado como «ola futura»: es esta.
 * `SubmitAttemptHandler` comprueba, cuando quien llama NO es dirección ni
 * profesorado, que `studentProfileId` es él mismo o su tutelado
 * (`StudentMinorPort.isSelfOrGuardian`) — nunca este controlador, que solo
 * transporta la petición.
 */
@Roles("owner", "admin", "teacher")
@Controller("assessments")
export class AttemptsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Roles("owner", "admin", "teacher", "student", "guardian")
  @Post("attempts")
  async submit(@Body() dto: SubmitAttemptDto) {
    return this.commands.execute(
      new SubmitAttemptCommand({
        exerciseId: dto.exerciseId,
        studentProfileId: dto.studentProfileId,
        response: dto.response,
        sessionId: dto.sessionId ?? null,
        assessmentId: dto.assessmentId ?? null,
        startedAt: dto.startedAt ?? null,
        durationMs: dto.durationMs ?? null,
      }),
    );
  }

  /** Bandeja del profesor (paso 5): correcciones pendientes de firma, la más antigua primero. */
  @Get("attempts/pending")
  async pending() {
    return this.queries.execute(new GetPendingAttemptsQuery());
  }

  @Post("attempts/:id/validate")
  async validate(@Param("id") id: string, @Body() dto: ValidateAttemptDto) {
    return this.commands.execute(
      new ValidateAttemptCommand({
        attemptId: id,
        teacherScore: dto.teacherScore,
        teacherFeedback: dto.teacherFeedback ?? null,
      }),
    );
  }

  @Post("attempts/:id/return")
  async return(@Param("id") id: string, @Body() dto: ReturnAttemptDto) {
    return this.commands.execute(
      new ReturnAttemptCommand({
        attemptId: id,
        teacherFeedback: dto.teacherFeedback,
      }),
    );
  }
}
