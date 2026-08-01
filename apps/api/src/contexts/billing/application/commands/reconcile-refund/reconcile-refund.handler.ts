import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
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
import {
  INVOICE_REPOSITORY,
  type InvoiceRepository,
} from "../../../domain/ports/invoice.repository.port.js";
import { PaymentProvider } from "../../../domain/ports/payment-gateway.port.js";
import {
  PROCESSED_WEBHOOK_EVENTS,
  type ProcessedWebhookEvents,
} from "../../../domain/ports/processed-webhook-events.port.js";
import { ReconcileRefundCommand } from "./reconcile-refund.command.js";

type Applied = { invoice: Invoice; feeReversedCents: number };

/**
 * Paso 4 del brief: `charge.refunded` ya traducido a `refundRef`.
 *
 * Solo reconcilia devoluciones que YA conocíamos como `pending` —las que
 * `RefundPaymentHandler` registró tras pedirle al proveedor que devolviera y
 * no recibir confirmación al instante—. Una devolución abierta enteramente
 * desde fuera (el panel del proveedor, no el nuestro) no tiene fila que
 * reconciliar y este manejador la ignora, registrándolo: importar
 * devoluciones ajenas es una función que nadie ha pedido todavía.
 *
 * Idempotente, igual que `ReconcilePaymentHandler`: si la devolución ya está
 * `succeeded`, no se toca nada.
 */
@CommandHandler(ReconcileRefundCommand)
export class ReconcileRefundHandler implements ICommandHandler<ReconcileRefundCommand> {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly invoices: InvoiceRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(PROCESSED_WEBHOOK_EVENTS) private readonly processedEvents: ProcessedWebhookEvents,
    @InjectPinoLogger(ReconcileRefundHandler.name) private readonly logger: PinoLogger,
  ) {}

  /** Ver el gemelo en `ReconcilePaymentHandler`. */
  private async claimEvent(props: {
    eventId?: string | null;
    eventType?: string | null;
  }): Promise<boolean> {
    if (!props.eventId) return true;

    const claimed = await this.processedEvents.claim({
      schoolId: this.tenant.schoolId(),
      provider: PaymentProvider.Stripe,
      eventId: props.eventId,
      eventType: props.eventType ?? "charge.refunded",
    });

    if (!claimed) {
      this.logger.info(`Evento ${props.eventId} ya procesado: esta entrega no repite nada.`);
    }
    return claimed;
  }

  async execute(command: ReconcileRefundCommand) {
    const { refundRef } = command.props;
    const now = this.clock.now();

    const applied: Applied | null = await this.uow.execute(async () => {
      // Lo PRIMERO de la transacción: reclamar el evento. Si otra entrega ya
      // lo procesó, no se repite nada; si otra lo está procesando ahora mismo,
      // Postgres hace esperar aquí. Los proveedores reenvían eventos por
      // diseño: sin esto, dos entregas del mismo aviso emitían dos documentos
      // por el mismo dinero.
      if (!(await this.claimEvent(command.props))) return null;

      const refund = await this.invoices.findRefundByProviderRef(refundRef);
      if (!refund) {
        this.logger.warn(`Devolución ${refundRef}: ninguna devolución nuestra tiene esta referencia.`);
        return null;
      }

      if (refund.status === "succeeded") {
        // Idempotencia: segunda entrega del mismo evento, o confirmación
        // asíncrona de una devolución que ya se había cerrado síncronamente.
        return null;
      }

      const invoiceId = InvoiceId.of(refund.invoiceId);
      const invoice = await this.invoices.findOrFail(invoiceId);
      const amount = Money.of(refund.amountCents, refund.currency);

      const { feeReversedCents } = invoice.refund({ amount, reason: refund.reason, now });
      await this.invoices.save(invoice);

      const fullyRefunded = invoice.amountRefundedCents >= invoice.amountPaidCents;
      await this.invoices.markRefundSucceeded({
        refundId: refund.refundId,
        applicationFeeReversedCents: feeReversedCents,
        processedAt: now,
        fullyRefunded,
      });

      return { invoice, feeReversedCents };
    });

    if (!applied) {
      return { applied: false, invoiceId: null, feeReversedCents: null };
    }

    await this.events.publish(applied.invoice.pullDomainEvents());

    return {
      applied: true,
      invoiceId: applied.invoice.id.value,
      feeReversedCents: applied.feeReversedCents,
    };
  }
}
