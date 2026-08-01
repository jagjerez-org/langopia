import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { InvoiceListItem } from "@langopia/contracts";
import {
  BILLING_READ_MODEL,
  type BillingReadModel,
} from "../../ports/billing-read-model.port.js";

export class ListInvoicesQuery extends Query<InvoiceListItem[]> {
  constructor(readonly props: { status?: string }) {
    super();
  }
}

/**
 * Listado de facturas de la escuela activa (Tarea 10 del panel, Paso 1),
 * opcionalmente filtrado por estado.
 *
 * Puro paso a través del modelo de lectura: ni suma ni decide nada, para que
 * "cero lógica de negocio en el frontend" tenga un lado servidor del que
 * depender — el filtro por estado es el único parámetro, y es un `WHERE`, no
 * una regla.
 */
@QueryHandler(ListInvoicesQuery)
export class ListInvoicesHandler implements IQueryHandler<ListInvoicesQuery> {
  constructor(@Inject(BILLING_READ_MODEL) private readonly readModel: BillingReadModel) {}

  async execute(query: ListInvoicesQuery): Promise<InvoiceListItem[]> {
    return this.readModel.listInvoices({ status: query.props.status });
  }
}
