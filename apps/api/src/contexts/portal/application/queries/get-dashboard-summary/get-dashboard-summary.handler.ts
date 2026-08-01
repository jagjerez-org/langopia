import { Inject } from "@nestjs/common";
import { Query, QueryBus, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  PORTAL_READ_MODEL,
  type AtRiskStudent,
  type PortalReadModel,
} from "../../ports/portal-read-model.port.js";
import { GetStudentsAtRiskQuery } from "../get-students-at-risk/get-students-at-risk.handler.js";

/** Misma ventana que la consulta de riesgo: un solo número, no dos que puedan divergir. */
const ATTENDANCE_WINDOW_DAYS = 28;

export type DashboardSummary = {
  activeStudents: number;
  averageAttendanceRate: number;
  /** Ausente hasta que exista el contexto `feedback` (ola 3). */
  nps: null;
  invoicedThisMonth: { amountCents: number; currency: string };
  studentsRequiringAttention: AtRiskStudent[];
};

export class GetDashboardSummaryQuery extends Query<DashboardSummary> {}

/**
 * Resumen del panel de dirección.
 *
 * La ocupación del profesorado NO va en esta respuesta: ya existe (`GET
 * /scheduling/teacher-occupancy`, ya hecha y verificada) y el panel web la
 * consulta aparte — repetirla aquí sería mantener el mismo número en dos
 * sitios. El NPS queda `null` a propósito: no hay encuestas hasta que
 * `feedback` (ola 3) exista, y un panel que inventa un cero engañaría más
 * que uno que dice «todavía no».
 *
 * «Alumnos que requieren atención» reutiliza `GetStudentsAtRiskQuery` por el
 * bus en vez de repetir su SQL: es la misma consulta del Paso 1, no una
 * segunda versión que pueda desincronizarse.
 */
@QueryHandler(GetDashboardSummaryQuery)
export class GetDashboardSummaryHandler implements IQueryHandler<GetDashboardSummaryQuery> {
  constructor(
    @Inject(PORTAL_READ_MODEL) private readonly readModel: PortalReadModel,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly queries: QueryBus,
  ) {}

  async execute(): Promise<DashboardSummary> {
    const now = this.clock.now();
    const attendanceFrom = new Date(now.getTime() - ATTENDANCE_WINDOW_DAYS * 24 * 3_600_000);
    const invoicedFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const invoicedTo = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [core, studentsRequiringAttention] = await Promise.all([
      this.readModel.coreMetrics({ attendanceFrom, attendanceTo: now, invoicedFrom, invoicedTo }),
      this.queries.execute(new GetStudentsAtRiskQuery()) as Promise<AtRiskStudent[]>,
    ]);

    return {
      activeStudents: core.activeStudents,
      averageAttendanceRate: core.averageAttendanceRate,
      nps: null,
      invoicedThisMonth: { amountCents: core.invoicedThisMonthCents, currency: core.currency },
      studentsRequiringAttention,
    };
  }
}
