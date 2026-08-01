import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  PORTAL_READ_MODEL,
  type AtRiskStudent,
  type PortalReadModel,
} from "../../ports/portal-read-model.port.js";

/** Ventana de asistencia «reciente»: las últimas cuatro semanas. */
const ATTENDANCE_WINDOW_DAYS = 28;
/** Por debajo de esto, la asistencia por sí sola marca riesgo. */
const LOW_ATTENDANCE_BELOW = 0.6;
/** Tres semanas sin una valoración de progreso (o ninguna nunca) marcan riesgo. */
const WEEKS_WITHOUT_EVALUATION = 3;

export class GetStudentsAtRiskQuery extends Query<AtRiskStudent[]> {}

/**
 * Riesgo de baja — versión mínima de la ola 1.
 *
 * Solo las dos señales que pide el brief: asistencia de las últimas cuatro
 * semanas por debajo del 60 %, o sin una valoración de progreso en las
 * últimas tres. La versión completa —siete señales ponderadas con
 * `low`/`medium`/`high`— es la Tarea 3 de la ola 3 (`feedback`); esto no la
 * anticipa ni la sustituye, es lo que el panel de esta ola necesita para
 * enseñar a quién hay que llamar.
 *
 * Sin aprendizaje automático: cada motivo es una comparación explicable, y
 * el resultado siempre los incluye — un alumno en la lista sin decir por qué
 * no sirve para actuar.
 */
@QueryHandler(GetStudentsAtRiskQuery)
export class GetStudentsAtRiskHandler implements IQueryHandler<GetStudentsAtRiskQuery> {
  constructor(
    @Inject(PORTAL_READ_MODEL) private readonly readModel: PortalReadModel,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(): Promise<AtRiskStudent[]> {
    const now = this.clock.now();
    const attendanceFrom = new Date(now.getTime() - ATTENDANCE_WINDOW_DAYS * 24 * 3_600_000);

    const rows = await this.readModel.studentsAtRisk({ attendanceFrom, attendanceTo: now, now });

    return rows
      .map((row): AtRiskStudent => {
        const reasons: AtRiskStudent["reasons"] = [];
        if (row.attendanceRate !== null && row.attendanceRate < LOW_ATTENDANCE_BELOW) {
          reasons.push("low_attendance");
        }
        if (
          row.weeksSinceLastEvaluation === null ||
          row.weeksSinceLastEvaluation >= WEEKS_WITHOUT_EVALUATION
        ) {
          reasons.push("no_recent_evaluation");
        }
        return { ...row, reasons };
      })
      .filter((row) => row.reasons.length > 0);
  }
}
