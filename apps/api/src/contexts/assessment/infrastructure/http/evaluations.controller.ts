import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { Roles } from "../../../shared/infrastructure/http/roles.decorator.js";
import { EvaluateStudentCommand } from "../../application/commands/evaluate-student/evaluate-student.command.js";
import { GetStudentsWithoutEvaluationQuery } from "../../application/queries/get-students-without-evaluation/get-students-without-evaluation.handler.js";
import { EvaluateStudentDto, StudentsWithoutEvaluationQueryDto } from "./dto/assessment.dto.js";

/**
 * Adaptador de ENTRADA sobre HTTP.
 *
 * Sin lógica de negocio: traduce la petición a un comando o una consulta y
 * los pone en el bus. `owner`/`admin`/`teacher`, nunca `student` ni
 * `guardian` — el alumno no valora ni edita su propia valoración, y el fallo
 * por defecto es denegar (`AuthenticatedGuard`). Que la valoración sea
 * precisamente de ESE profesor sobre ESE alumno en ESE periodo no lo decide
 * este rol: lo decide `TeachesStudentPort` dentro del comando.
 */
@Roles("owner", "admin", "teacher")
@Controller("assessments")
export class EvaluationsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Post("evaluations")
  async evaluate(@Body() dto: EvaluateStudentDto) {
    return this.commands.execute(
      new EvaluateStudentCommand({
        teacherId: dto.teacherId,
        studentId: dto.studentId,
        periodStart: dto.periodStart,
        periodEnd: dto.periodEnd,
        progressRating: dto.progressRating,
        levelAtEvaluation: dto.levelAtEvaluation ?? null,
        strengths: dto.strengths ?? null,
        improvements: dto.improvements ?? null,
        nextSteps: dto.nextSteps ?? null,
      }),
    );
  }

  /** Alumnado sin valorar: la señal que alimenta el panel de dirección. */
  @Get("students-without-evaluation")
  async studentsWithoutEvaluation(@Query() query: StudentsWithoutEvaluationQueryDto) {
    return this.queries.execute(new GetStudentsWithoutEvaluationQuery({ weeks: query.weeks }));
  }
}
