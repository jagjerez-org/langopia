import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { InvoiceDetail } from "@langopia/contracts";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { InvoiceId } from "../../../domain/model/identifiers.js";
import {
  INVOICE_REPOSITORY,
  type InvoiceRepository,
} from "../../../domain/ports/invoice.repository.port.js";
import {
  BILLING_READ_MODEL,
  type BillingReadModel,
} from "../../ports/billing-read-model.port.js";

export class GetInvoiceDetailQuery extends Query<InvoiceDetail> {
  constructor(readonly props: { invoiceId: string }) {
    super();
  }
}

/**
 * Detalle de una factura (Tarea 10 del panel, Paso 2): líneas, cobros,
 * devoluciones y la comisión de plataforma desglosada —la escuela tiene
 * derecho a ver qué se le retiene.
 *
 * Carga el agregado `Invoice` de verdad (vía `InvoiceRepository`, el MISMO
 * repositorio que usan los comandos) en vez de repetir en SQL las sumas que
 * ya audita ese repositorio (`amountPaidCents`, `amountRefundedCents`,
 * `remainingBalance`, `refundableBalance`): son justo las cuentas que el
 * saneamiento de esta ola encontró rotas y arregló, y una segunda copia en el
 * lado de lectura sería una tercera oportunidad de que las dos versiones
 * dejen de coincidir. El modelo de lectura (`BillingReadModel`) solo aporta
 * lo que el agregado no tiene sentido que sepa: el nombre de a quién se
 * factura, y el historial completo de cobros y devoluciones (el agregado
 * solo guarda sus SUMAS, no la lista).
 */
@QueryHandler(GetInvoiceDetailQuery)
export class GetInvoiceDetailHandler implements IQueryHandler<GetInvoiceDetailQuery> {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly invoices: InvoiceRepository,
    @Inject(BILLING_READ_MODEL) private readonly readModel: BillingReadModel,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async execute(query: GetInvoiceDetailQuery): Promise<InvoiceDetail> {
    const invoiceId = InvoiceId.of(query.props.invoiceId);
    const invoice = await this.uow.read(() => this.invoices.findOrFail(invoiceId));

    const [billedToName, payments, refunds] = await Promise.all([
      this.readModel.billedToName(invoice.billToMembershipId?.value ?? null),
      this.readModel.paymentsForInvoice(invoiceId.value),
      this.readModel.refundsForInvoice(invoiceId.value),
    ]);

    return {
      invoiceId: invoice.id.value,
      number: invoice.number,
      direction: invoice.direction,
      status: invoice.status,
      currency: invoice.currency,
      locale: invoice.locale,
      billedToName,
      subtotalCents: invoice.subtotalCents,
      taxCents: invoice.taxCents,
      taxRateBps: invoice.taxRateBps,
      totalCents: invoice.totalCents,
      applicationFeeBps: invoice.applicationFeeBps,
      applicationFeeCents: invoice.applicationFeeCents,
      issuedOn: invoice.issuedOn.toISOString(),
      dueOn: invoice.dueOn.toISOString(),
      paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
      amountPaidCents: invoice.amountPaidCents,
      amountRefundedCents: invoice.amountRefundedCents,
      remainingCents: invoice.remainingBalance.cents,
      refundableCents: invoice.refundableBalance.cents,
      lines: invoice.lines.map((line) => ({
        id: line.id,
        description: line.description,
        quantity: line.quantity,
        unitCents: line.unitCents,
        totalCents: line.totalCents,
        courseId: line.courseId,
        sessionId: line.sessionId,
      })),
      payments,
      refunds,
    };
  }
}
