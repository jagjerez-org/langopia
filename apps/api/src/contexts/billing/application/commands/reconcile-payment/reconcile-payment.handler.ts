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
import { Receipt, ReceiptKind } from "../../../domain/model/receipt.js";
import {
  INVOICE_REPOSITORY,
  type InvoiceRepository,
} from "../../../domain/ports/invoice.repository.port.js";
import { PaymentProvider } from "../../../domain/ports/payment-gateway.port.js";
import {
  PROCESSED_WEBHOOK_EVENTS,
  type ProcessedWebhookEvents,
} from "../../../domain/ports/processed-webhook-events.port.js";
import { ReconcilePaymentCommand } from "./reconcile-payment.command.js";

type Applied = { invoice: Invoice; receipt: Receipt | null };

/**
 * Paso 4 del brief: `payment_intent.succeeded` ya traducido a `chargeRef`.
 *
 * No llama a ningún proveedor de pago: el cobro ya ocurrió allí, este
 * manejador solo pone al día lo que `RecordPaymentHandler` había dejado
 * `pending` (un medio de pago que no confirma al instante) — mismo cierre
 * que ese manejador hace tras un `charge()` con éxito (`markPaid()` +
 * recibo), pero sin la llamada de red que ya no hace falta repetir.
 *
 * Idempotente por diseño (paso 5b): si el cobro que trae `chargeRef` YA está
 * `succeeded` —por una entrega repetida del mismo evento, o porque el cobro
 * se había confirmado síncronamente y el proveedor manda este webhook
 * igual— no se toca nada. Los proveedores reintentan; cobrar dos veces por
 * un reintento convertiría un aviso duplicado en una devolución y una
 * llamada del cliente.
 */
@CommandHandler(ReconcilePaymentCommand)
export class ReconcilePaymentHandler implements ICommandHandler<ReconcilePaymentCommand> {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly invoices: InvoiceRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(PROCESSED_WEBHOOK_EVENTS) private readonly processedEvents: ProcessedWebhookEvents,
    @InjectPinoLogger(ReconcilePaymentHandler.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * `true` si este evento se puede procesar. Sin `eventId` —el comando no
   * viene de un webhook— no hay nada que reclamar y sigue adelante.
   */
  private async claimEvent(props: {
    eventId?: string | null;
    eventType?: string | null;
  }): Promise<boolean> {
    if (!props.eventId) return true;

    const claimed = await this.processedEvents.claim({
      schoolId: this.tenant.schoolId(),
      provider: PaymentProvider.Stripe,
      eventId: props.eventId,
      eventType: props.eventType ?? "payment_intent.succeeded",
    });

    if (!claimed) {
      this.logger.info(`Evento ${props.eventId} ya procesado: esta entrega no repite nada.`);
    }
    return claimed;
  }

  async execute(command: ReconcilePaymentCommand) {
    const { chargeRef, amountCents, currency } = command.props;
    const now = this.clock.now();

    const applied: Applied | null = await this.uow.execute(async () => {
      // Lo PRIMERO de la transacción: reclamar el evento. Si otra entrega ya
      // lo procesó, no se repite nada; si otra lo está procesando ahora mismo,
      // Postgres hace esperar aquí. Los proveedores reenvían eventos por
      // diseño: sin esto, dos entregas del mismo aviso emitían dos documentos
      // por el mismo dinero.
      if (!(await this.claimEvent(command.props))) return null;

      const payment = await this.invoices.findPaymentByProviderRef(chargeRef);
      if (!payment) {
        this.logger.warn(`Cobro ${chargeRef}: ningún cobro nuestro tiene esta referencia.`);
        return null;
      }

      if (payment.status === "succeeded") {
        // Ya reconciliado: segunda entrega del mismo evento, o confirmación
        // asíncrona de un cobro que ya se había cerrado síncronamente.
        return null;
      }

      const invoiceId = InvoiceId.of(payment.invoiceId);
      const invoice = await this.invoices.findOrFail(invoiceId);

      // El importe lo dice el PROVEEDOR, no nosotros: es quien movió el
      // dinero. Nuestra fila es lo que pedimos cobrar, y si ambos difieren
      // —un cobro que el proveedor ajustó, un importe que cambió entre la
      // petición y la confirmación— quedarse con el nuestro es dar por bueno
      // el dato equivocado y descuadrar la factura. Solo se recurre al
      // registrado si el evento no trae importe.
      const ours = Money.of(payment.amountCents, payment.currency);
      const fromProvider =
        amountCents != null && currency ? Money.of(amountCents, currency) : null;

      if (fromProvider && !fromProvider.equals(ours)) {
        this.logger.warn(
          `Cobro ${chargeRef}: el proveedor dice ${fromProvider.cents} ${fromProvider.currency} y ` +
            `nosotros teníamos ${ours.cents} ${ours.currency}. Manda el proveedor.`,
        );
      }

      const amount = fromProvider ?? ours;

      // La comisión proporcional a ESTE cobro: `recordPayment()` la había
      // guardado en cero porque, al quedar `pending`, no se sabía todavía si
      // de verdad se iba a cobrar.
      const fee = invoice.proportionalFee(amount);

      invoice.markPaid({ amount, method: payment.method, providerRef: chargeRef, now });
      await this.invoices.save(invoice);
      await this.invoices.markPaymentSucceeded({
        paymentId: payment.paymentId,
        amountCents: amount.cents,
        currency: amount.currency,
        applicationFeeCents: fee.cents,
        paidAt: now,
      });

      // Mismo criterio que `RecordPaymentHandler`: cualquier cobro con éxito
      // emite recibo, complete o no la factura.
      const sequence = await this.invoices.nextReceiptSequence({
        schoolId: invoice.schoolId.value,
        year: now.getFullYear(),
        kind: ReceiptKind.Payment,
      });
      const receipt = Receipt.forPayment({
        sequence,
        year: now.getFullYear(),
        invoiceId: invoiceId.value,
        paymentId: payment.paymentId,
        amount,
        method: payment.method,
        issuedAt: now,
      });

      return { invoice, receipt };
    });

    if (!applied) {
      return { applied: false, invoiceId: null, invoiceStatus: null, receiptNumber: null };
    }

    await this.events.publish(applied.invoice.pullDomainEvents());

    return {
      applied: true,
      invoiceId: applied.invoice.id.value,
      invoiceStatus: applied.invoice.status,
      receiptNumber: applied.receipt?.number ?? null,
    };
  }
}
