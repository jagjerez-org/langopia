import { Module } from "@nestjs/common";
import { PORTAL_READ_MODEL } from "./application/ports/portal-read-model.port.js";
import { GetDashboardSummaryHandler } from "./application/queries/get-dashboard-summary/get-dashboard-summary.handler.js";
import { GetMyAttendanceHandler } from "./application/queries/get-my-attendance/get-my-attendance.handler.js";
import { GetMyInvoicesHandler } from "./application/queries/get-my-invoices/get-my-invoices.handler.js";
import { GetMySessionsHandler } from "./application/queries/get-my-sessions/get-my-sessions.handler.js";
import { GetMyStudentsHandler } from "./application/queries/get-my-students/get-my-students.handler.js";
import { GetStudentsAtRiskHandler } from "./application/queries/get-students-at-risk/get-students-at-risk.handler.js";
import { DashboardController } from "./infrastructure/http/dashboard.controller.js";
import { StudentPortalController } from "./infrastructure/http/student-portal.controller.js";
import { DrizzlePortalReadModel } from "./infrastructure/persistence/drizzle-portal-read-model.js";

const queryHandlers = [
  GetStudentsAtRiskHandler,
  GetDashboardSummaryHandler,
  GetMySessionsHandler,
  GetMyAttendanceHandler,
  GetMyInvoicesHandler,
  GetMyStudentsHandler,
];

/**
 * Contexto acotado del portal: el panel de dirección y el portal del alumno.
 *
 * A diferencia de los demás, no tiene agregados propios que proteger — es
 * puro lado de lectura sobre lo que ya construyeron `people`, `scheduling` y
 * `billing`. El módulo es la frontera igual que en cualquier otro contexto:
 * aquí se ata `PORTAL_READ_MODEL` a su adaptador, y nada de esto sale fuera.
 */
@Module({
  controllers: [DashboardController, StudentPortalController],
  providers: [...queryHandlers, { provide: PORTAL_READ_MODEL, useClass: DrizzlePortalReadModel }],
})
export class PortalModule {}
