import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { InvoiceMonthlyTotal } from "@langopia/contracts";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  BILLING_READ_MODEL,
  type BillingReadModel,
} from "../../ports/billing-read-model.port.js";

export type BillingSummary = { monthTotal: InvoiceMonthlyTotal };

export class GetBillingSummaryQuery extends Query<BillingSummary> {}

/**
 * Resumen de facturación (Tarea 10 del panel, Paso 1): el total del mes que
 * el listado enseña junto al filtro por estado.
 *
 * Mismo límite de mes natural que `GetDashboardSummaryHandler`
 * (`portal/application/queries/get-dashboard-summary`): `[primer día del mes,
 * primer día del siguiente)`, calculado con `Clock` — nunca `new Date()`
 * directo — para que un mismo instante dé siempre el mismo resultado en las
 * pruebas. Es una consulta propia y no una llamada a la del panel de
 * dirección: los contextos acotados no comparten lado de lectura, igual que
 * `scheduling` y `catalog` no comparten el suyo.
 */
@QueryHandler(GetBillingSummaryQuery)
export class GetBillingSummaryHandler implements IQueryHandler<GetBillingSummaryQuery> {
  constructor(
    @Inject(BILLING_READ_MODEL) private readonly readModel: BillingReadModel,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(): Promise<BillingSummary> {
    const now = this.clock.now();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthTotal = await this.readModel.monthlyTotal({ from, to });
    return { monthTotal };
  }
}
