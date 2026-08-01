import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { Roles } from "../../../shared/infrastructure/http/roles.decorator.js";
import { GenerateExamCommand } from "../../application/commands/generate-exam/generate-exam.command.js";
import { GradeExamCommand } from "../../application/commands/grade-exam/grade-exam.command.js";
import { StartExamCommand } from "../../application/commands/start-exam/start-exam.command.js";
import { SubmitExamCommand } from "../../application/commands/submit-exam/submit-exam.command.js";
import { ValidateExamCommand } from "../../application/commands/validate-exam/validate-exam.command.js";
import { GetExamQuery } from "../../application/queries/get-exam/get-exam.handler.js";
import { GenerateExamDto, SubmitExamDto, ValidateExamDto } from "./dto/assessment.dto.js";

/**
 * Adaptador de ENTRADA sobre HTTP (Tarea 15 de la ola 2).
 *
 * Sin lógica de negocio: traduce la petición a un comando y lo pone en el
 * bus. `owner`/`admin`/`teacher` para las cinco rutas — generar, empezar,
 * entregar, corregir y firmar un examen es hoy el equipo digitalizándolo con
 * el alumno delante, igual que `AttemptsController` y `PlacementTestController`;
 * el autoservicio del alumno (portal, ola futura) llamará a los mismos
 * comandos resolviendo `studentProfileId`/`examId` de su propia sesión.
 */
@Roles("owner", "admin", "teacher")
@Controller("assessments/exams")
export class ExamsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get(":id")
  async get(@Param("id") id: string) {
    return this.queries.execute(new GetExamQuery({ examId: id }));
  }

  @Post()
  async generate(@Body() dto: GenerateExamDto) {
    return this.commands.execute(
      new GenerateExamCommand({
        kind: dto.kind,
        studentProfileIds: dto.studentProfileIds,
        title: dto.title,
        language: dto.language,
        level: dto.level,
        sourceContentUnitIds: dto.sourceContentUnitIds,
        skillDistribution: dto.skillDistribution,
        durationMinutes: dto.durationMinutes,
        mockFramework: dto.mockFramework ?? null,
        scheduledFor: dto.scheduledFor ?? null,
      }),
    );
  }

  @Post(":id/start")
  async start(@Param("id") id: string) {
    return this.commands.execute(new StartExamCommand({ examId: id }));
  }

  @Post(":id/submit")
  async submit(@Param("id") id: string, @Body() dto: SubmitExamDto) {
    return this.commands.execute(new SubmitExamCommand({ examId: id, responses: dto.responses }));
  }

  @Post(":id/grade")
  async grade(@Param("id") id: string) {
    return this.commands.execute(new GradeExamCommand({ examId: id }));
  }

  @Post(":id/validate")
  async validate(@Param("id") id: string, @Body() dto: ValidateExamDto) {
    return this.commands.execute(new ValidateExamCommand({ examId: id, score: dto.score }));
  }
}
