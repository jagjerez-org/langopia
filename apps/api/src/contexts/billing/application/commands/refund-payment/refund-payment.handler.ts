import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { InvoiceId } from "../../../domain/model/identifiers.js";
import type { Invoice } from "../../../domain/model/invoice.aggregate.js";
import { Money } from "../../../domain/model/money.vo.js";
import { Receipt, ReceiptKind } from "../../../domain/model/receipt.js";
import {
  INVOICE_REPOSITORY,
  type InvoiceRepository,
} from "../../../domain/ports/invoice.repository.port.js";
import {
  PAYMENT_GATEWAY,
  type PaymentGatewayPort,
  type RefundResult,
} from "../../../domain/ports/payment-gateway.port.js";
import { RefundPaymentCommand } from "./refund-payment.command.js";

/**
 * Devuelve, total o parcialmente, lo cobrado de una factura.
 *
 * Mismo esqueleto que `RecordPaymentHandler`: se decide y se valida contra el
 * agregado ANTES de tocar red (`invoice.refund()` ya lanza `refund_exceeds_
 * payment` aquí, sin necesidad de llamar al proveedor para saberlo), se llama
 * al proveedor fuera de cualquier transacción, y el resultado se aplica de
 * verdad —otra vez contra un `Invoice` releído— dentro de `uow.execute()`.
 */
@CommandHandler(RefundPaymentCommand)
export class RefundPaymentHandler implements ICommandHandler<RefundPaymentCommand> {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly invoices: InvoiceRepository,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGatewayPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @InjectPinoLogger(RefundPaymentHandler.name) private readonly logger: PinoLogger,
  ) {}

  async execute(command: RefundPaymentCommand) {
    const { props } = command;
    const invoiceId = InvoiceId.of(props.invoiceId);

    const { amount, feeReversed, charge, paymentId, schoolId } = await this.uow.read(async () => {
      const invoice = await this.invoices.findOrFail(invoiceId);
      const amount = Money.of(props.amountCents, invoice.currency);
      // Valida aquí mismo «no se puede devolver más de lo cobrado», contando
      // también las devoluciones ya pedidas y sin confirmar. Sin mutar nada:
      // es una consulta, no un ensayo sobre una copia.
      invoice.assertCanBeRefunded(amount);
      const feeReversedCents = invoice.refundFeeFor(amount).cents;

      const payment = await this.invoices.findLatestSucceededPayment(invoiceId);
      if (!payment) throw new NotFoundError("cobro de la factura", invoiceId.value);

      return {
        amount,
        feeReversed: Money.of(feeReversedCents, invoice.currency),
        charge: payment.charge,
        paymentId: payment.paymentId,
        schoolId: invoice.schoolId.value,
      };
    });

    const result = await this.gateway.refund({
      charge,
      amount,
      reason: props.reason,
      feeReversed,
      idempotencyKey: props.idempotencyKey,
    });

    const now = this.clock.now();
    let closed: { invoice: Invoice; refundId: string; receipt: Receipt | null };
    try {
      closed = await this.uow.execute(async () => {
        const invoice = await this.invoices.findOrFail(invoiceId);
        let feeReversedCents = 0;

        if (result.status === "succeeded") {
          ({ feeReversedCents } = invoice.refund({ amount, reason: props.reason, now }));
          await this.invoices.save(invoice);
        }

        const { refundId } = await this.invoices.recordRefund({
          schoolId: invoice.schoolId.value,
          paymentId,
          amountCents: amount.cents,
          currency: amount.currency,
          reason: props.reason,
          applicationFeeReversedCents: feeReversedCents,
          refund: result.refund,
          status: result.status,
          // Quien pidió la devolución en ESTA petición: una persona desde el
          // panel, o quien canceló la clase cuando lo abre `OnClassSessionCanceled`
          // — sigue siendo la misma sesión/CLS, así que sigue siendo la misma
          // membresía. `null` solo en trabajos de sistema sin sesión detrás.
          requestedByMembershipId: this.tenant.membershipId(),
          fullyRefunded: result.status === "succeeded" && invoice.amountRefundedCents >= invoice.amountPaidCents,
          now,
        });

        // «Una devolución no anula el recibo: emite un abono aparte.» — solo
        // cuando el proveedor confirma; una devolución pendiente o fallida no
        // acredita nada todavía.
        let receipt: Receipt | null = null;
        if (result.status === "succeeded") {
          const sequence = await this.invoices.nextReceiptSequence({
            schoolId: invoice.schoolId.value,
            year: now.getFullYear(),
            kind: ReceiptKind.CreditNote,
          });
          receipt = Receipt.forRefund({
            sequence,
            year: now.getFullYear(),
            invoiceId: invoiceId.value,
            paymentId,
            amount,
            reason: props.reason,
            issuedAt: now,
          });
        }

        return { invoice, refundId, receipt };
      });
    } catch (error) {
      await this.leaveUnreconciledTrace({ schoolId, paymentId, amount, reason: props.reason, result, now });
      throw error;
    }

    await this.events.publish(closed.invoice.pullDomainEvents());

    return {
      refundId: closed.refundId,
      status: result.status,
      feeReversedCents: feeReversed.cents,
      receiptNumber: closed.receipt?.number ?? null,
    };
  }

  /**
   * Simétrico a `RecordPaymentHandler.leaveUnreconciledTrace`, y por el mismo
   * motivo: el proveedor devolvió el dinero de verdad y la transacción que
   * iba a registrarlo se deshizo entera. Sin rastro, ese dinero sale de la
   * cuenta de la escuela sin que ninguna fila lo cuente.
   *
   * Se anota como `pending` en una transacción nueva: es la forma que
   * `ReconcileRefundHandler` sabe cerrar cuando llegue `charge.refunded`, así
   * que la reconciliación por webhook recupera el caso sola.
   */
  private async leaveUnreconciledTrace(params: {
    schoolId: string;
    paymentId: string;
    amount: Money;
    reason: string;
    result: RefundResult;
    now: Date;
  }): Promise<void> {
    // Una devolución rechazada no movió dinero: no hay nada que reconciliar.
    if (params.result.status === "failed") return;

    try {
      await this.uow.execute(() =>
        this.invoices.recordRefund({
          schoolId: params.schoolId,
          paymentId: params.paymentId,
          amountCents: params.amount.cents,
          currency: params.amount.currency,
          reason: params.reason,
          applicationFeeReversedCents: 0,
          refund: params.result.refund,
          status: "pending",
          requestedByMembershipId: this.tenant.membershipId(),
          fullyRefunded: false,
          now: params.now,
        }),
      );
      this.logger.error(
        `Devolución ${params.result.refund.ref} del cobro ${params.paymentId}: el proveedor devolvió ` +
          "pero no se pudo cerrar el registro. Queda anotada como pendiente de reconciliar.",
      );
    } catch (traceError) {
      this.logger.error(
        { err: traceError },
        `Devolución ${params.result.refund.ref} del cobro ${params.paymentId}: el proveedor devolvió ` +
          "y NO se ha podido dejar rastro. Requiere conciliación manual.",
      );
    }
  }
}
