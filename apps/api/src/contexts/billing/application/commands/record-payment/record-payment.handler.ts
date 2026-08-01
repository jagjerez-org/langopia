import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
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
  PaymentProvider,
  type ChargeResult,
  type PaymentGatewayPort,
} from "../../../domain/ports/payment-gateway.port.js";
import {
  SCHOOL_BILLING_POLICY_PORT,
  type SchoolBillingPolicyPort,
} from "../../../domain/ports/school-billing-policy.port.js";
import { RecordPaymentCommand } from "./record-payment.command.js";

/**
 * Cobra una factura `school_to_student` y registra el resultado.
 *
 * El cobro al proveedor de pago ocurre FUERA de `uow.execute()` — igual que
 * `OnClassSessionScheduled` crea la sala de LiveKit antes de escribir nada—:
 * una llamada de red no debe mantener abierta una transacción de Postgres, y
 * `idempotencyKey` es justo la garantía que hace seguro reintentar si el
 * paso de guardar fallara después de cobrar.
 *
 * El orden manda, y es el saneamiento de esta tarea: cobrar es lo ÚNICO
 * irreversible de todo el recorrido, así que ninguna regla puede quedar por
 * comprobar cuando se llama al proveedor. Antes, `markPaid()` —quien lanza si
 * el cobro no procede— corría DESPUÉS del `charge()`: cobrar 50 € de una
 * factura ya pagada se llevaba el dinero de verdad y deshacía la transacción
 * sin dejar ni una fila en `payments`. Ahora las reglas se comprueban en el
 * paso 1 (`assertCanBePaid`) y, si aun así el cierre falla con el cobro ya
 * hecho, queda rastro (`leaveUnreconciledTrace`).
 *
 * Esta prueba (`*.spec.ts`, paso 9b del brief) sustituye `PaymentGatewayPort`
 * por un doble: si este manejador dependiera de un detalle del proveedor de
 * pago concreto, esa sustitución no bastaría para que pasara.
 */
@CommandHandler(RecordPaymentCommand)
export class RecordPaymentHandler implements ICommandHandler<RecordPaymentCommand> {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly invoices: InvoiceRepository,
    @Inject(SCHOOL_BILLING_POLICY_PORT) private readonly schoolBilling: SchoolBillingPolicyPort,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGatewayPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
    @InjectPinoLogger(RecordPaymentHandler.name) private readonly logger: PinoLogger,
  ) {}

  async execute(command: RecordPaymentCommand) {
    const { props } = command;
    const invoiceId = InvoiceId.of(props.invoiceId);
    const method = props.method ?? "card";

    // 1. Leer lo necesario para decidir CUÁNTO cobrar, y comprobar que el
    //    cobro PROCEDE. Dentro de `uow.read()`: sin tenant fijado, RLS no
    //    dejaría ver la factura.
    const { amount, fee, merchant, schoolId } = await this.uow.read(async () => {
      const invoice = await this.invoices.findOrFail(invoiceId);
      const amount =
        props.amountCents != null
          ? Money.of(props.amountCents, invoice.currency)
          : invoice.remainingBalance;

      // Todas las reglas, aquí, antes de que exista nada que deshacer.
      invoice.assertCanBePaid(amount);

      const merchantRef = await this.schoolBilling.merchantRef();

      return {
        amount,
        fee: invoice.proportionalFee(amount),
        schoolId: invoice.schoolId.value,
        merchant: {
          provider: PaymentProvider.Stripe,
          ref: merchantRef ?? "",
        },
      };
    });

    // 2. Cobrar. Ni una fila se ha tocado todavía, y ya no queda ninguna regla
    //    por comprobar.
    const result = await this.gateway.charge({
      amount,
      fee,
      payer: { email: props.payerEmail, providerCustomerRef: props.payerProviderCustomerRef },
      merchant,
      idempotencyKey: props.idempotencyKey,
    });

    // 3. Registrar el resultado. Releer la factura DENTRO de esta segunda
    //    transacción: entre el paso 1 y este, pudo cambiar.
    const now = this.clock.now();
    let closed: { invoice: Invoice; paymentId: string; receipt: Receipt | null };
    try {
      closed = await this.uow.execute(async () => {
        const invoice = await this.invoices.findOrFail(invoiceId);

        if (result.status === "succeeded") {
          invoice.markPaid({
            amount,
            method,
            providerRef: result.charge.ref,
            now,
          });
          await this.invoices.save(invoice);
        } else if (result.status === "failed") {
          // No cambia el estado de la factura —sigue exactamente igual que
          // antes de intentar cobrar—, pero `notifications` necesita saber que
          // el intento falló para avisar a quien paga. Ver `PaymentFailed`.
          invoice.recordPaymentFailure({
            amountCents: amount.cents,
            failureCode: result.failureCode ?? null,
            failureMessage: result.failureMessage ?? null,
          });
        }

        const { paymentId } = await this.invoices.recordPayment({
          schoolId: invoice.schoolId.value,
          invoiceId,
          amountCents: amount.cents,
          currency: amount.currency,
          method,
          applicationFeeCents: fee.cents,
          charge: result.charge,
          merchantRef: merchant.ref || null,
          status: result.status,
          failureCode: result.failureCode ?? null,
          failureMessage: result.failureMessage ?? null,
          paidAt: result.status === "succeeded" ? now : null,
        });

        // «Un cobro parcial genera un recibo parcial: no se espera al total.»
        // Se emite por CUALQUIER cobro con éxito, complete o no la factura.
        let receipt: Receipt | null = null;
        if (result.status === "succeeded") {
          const sequence = await this.invoices.nextReceiptSequence({
            schoolId: invoice.schoolId.value,
            year: now.getFullYear(),
            kind: ReceiptKind.Payment,
          });
          receipt = Receipt.forPayment({
            sequence,
            year: now.getFullYear(),
            invoiceId: invoiceId.value,
            paymentId,
            amount,
            method,
            issuedAt: now,
          });
        }

        return { invoice, paymentId, receipt };
      });
    } catch (error) {
      await this.leaveUnreconciledTrace({ schoolId, invoiceId, amount, method, merchant, result });
      throw error;
    }

    await this.events.publish(closed.invoice.pullDomainEvents());

    return {
      paymentId: closed.paymentId,
      status: result.status,
      invoiceStatus: closed.invoice.status,
      amountCents: amount.cents,
      receiptNumber: closed.receipt?.number ?? null,
    };
  }

  /**
   * El proveedor cobró de verdad, pero la transacción que iba a registrarlo se
   * deshizo entera. Sin esto no quedaría NI UNA fila de un dinero que sí salió
   * de la cuenta de quien paga: exactamente el agujero que esta tarea cierra.
   *
   * Se anota en una transacción NUEVA (la anterior ya está muerta) y como
   * `pending`, no como `succeeded`, por dos motivos:
   *
   *   · `pending` no cuenta en `amountPaidCents` —se deriva de los cobros
   *     efectivamente cobrados—, así que un cobro que nadie ha podido cerrar
   *     no da por pagada una factura ni descuadra el saldo.
   *   · `pending` con la referencia del proveedor es exactamente la forma que
   *     `ReconcilePaymentHandler` ya sabe cerrar cuando llegue
   *     `payment_intent.succeeded`. La reconciliación por webhook, que ya
   *     existe, es también el camino de recuperación de este caso.
   *
   * Si ni siquiera esto se puede escribir (Postgres caído), se registra en el
   * log y se relanza el error ORIGINAL: el rastro es un intento de mejora, no
   * una excusa para tapar el fallo de verdad.
   */
  private async leaveUnreconciledTrace(params: {
    schoolId: string;
    invoiceId: InvoiceId;
    amount: Money;
    method: string;
    merchant: { ref: string };
    result: ChargeResult;
  }): Promise<void> {
    // Un cobro rechazado no movió dinero: no hay nada que reconciliar.
    if (params.result.status === "failed") return;

    try {
      await this.uow.execute(() =>
        this.invoices.recordPayment({
          schoolId: params.schoolId,
          invoiceId: params.invoiceId,
          amountCents: params.amount.cents,
          currency: params.amount.currency,
          method: params.method,
          applicationFeeCents: 0,
          charge: params.result.charge,
          merchantRef: params.merchant.ref || null,
          status: "pending",
          paidAt: null,
        }),
      );
      this.logger.error(
        `Cobro ${params.result.charge.ref} de la factura ${params.invoiceId.value}: el proveedor ` +
          "cobró pero no se pudo cerrar el registro. Queda anotado como pendiente de reconciliar.",
      );
    } catch (traceError) {
      this.logger.error(
        { err: traceError },
        `Cobro ${params.result.charge.ref} de la factura ${params.invoiceId.value}: el proveedor ` +
          "cobró y NO se ha podido dejar rastro. Requiere conciliación manual.",
      );
    }
  }
}
