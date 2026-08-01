import { Controller, Get } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { Roles } from "../../../shared/infrastructure/http/roles.decorator.js";
import { GetDashboardSummaryQuery } from "../../application/queries/get-dashboard-summary/get-dashboard-summary.handler.js";

/**
 * Adaptador de ENTRADA sobre HTTP: el panel de dirección.
 *
 * Sin lógica de negocio, igual que `SchedulingController`: traduce la
 * petición a una consulta y devuelve el resultado. `owner`/`admin`: es
 * dirección, no el profesorado ni el alumnado.
 */
@Roles("owner", "admin")
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly queries: QueryBus) {}

  @Get("summary")
  async summary() {
    return this.queries.execute(new GetDashboardSummaryQuery());
  }
}
