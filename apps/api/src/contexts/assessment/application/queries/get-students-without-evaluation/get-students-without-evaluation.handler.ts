import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  ASSESSMENT_READ_MODEL,
  type AssessmentReadModel,
  type StudentWithoutEvaluation,
} from "../../ports/assessment-read-model.port.js";

/**
 * Semanas sin valorar que activan la señal, si no se pide otra cosa. Igual
 * que el panel de riesgo del portal (`GetStudentsAtRiskHandler`): tres
 * semanas sin una valoración de progreso (o ninguna nunca) es lo que hace
 * saltar la alarma.
 */
const DEFAULT_WEEKS = 3;

export class GetStudentsWithoutEvaluationQuery extends Query<StudentWithoutEvaluation[]> {
  constructor(readonly props: { weeks?: number } = {}) {
    super();
  }
}

/**
 * Consulta directa al modelo de lectura, sin pasar por el dominio. Igual que
 * `GetTeacherOccupancyHandler`: fino a propósito, sin lógica de negocio más
 * allá del valor por defecto de `weeks`.
 */
@QueryHandler(GetStudentsWithoutEvaluationQuery)
export class GetStudentsWithoutEvaluationHandler
  implements IQueryHandler<GetStudentsWithoutEvaluationQuery>
{
  constructor(
    @Inject(ASSESSMENT_READ_MODEL) private readonly readModel: AssessmentReadModel,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(query: GetStudentsWithoutEvaluationQuery): Promise<StudentWithoutEvaluation[]> {
    const weeks = query.props.weeks ?? DEFAULT_WEEKS;
    return this.readModel.studentsWithoutRecentEvaluation({ weeks, now: this.clock.now() });
  }
}
