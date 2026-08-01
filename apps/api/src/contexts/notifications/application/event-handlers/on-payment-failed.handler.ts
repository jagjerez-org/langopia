import { Inject } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { PaymentFailed } from "../../../billing/domain/events/invoice.events.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { INVOICE_DIRECTORY, type InvoiceDirectoryPort } from "../../domain/ports/invoice-directory.port.js";
import { MAILER, type MailerPort } from "../../domain/ports/mailer.port.js";
import { PEOPLE_DIRECTORY, type PeopleDirectoryPort } from "../../domain/ports/people-directory.port.js";
import { resolveInvoicePayerRecipient } from "./resolve-invoice-payer-recipient.js";

/**
 * `notifications` reacciona a un cobro fallido avisando a quien paga, para
 * que actualice sus datos. Mismo destinatario que `OnInvoiceIssued`
 * (`resolveInvoicePayerRecipient`): el contacto de facturación si lo hay, si
 * no el alumno (o su tutor, si es menor).
 *
 * `PaymentFailed.payload()` no lleva el número de la factura —no le hace
 * falta a `billing`—, así que también hace falta `InvoiceDirectoryPort` para
 * el número, no solo para el destinatario.
 */
@EventsHandler(PaymentFailed)
export class OnPaymentFailed implements IEventHandler<PaymentFailed> {
  constructor(
    @Inject(INVOICE_DIRECTORY) private readonly invoices: InvoiceDirectoryPort,
    @Inject(PEOPLE_DIRECTORY) private readonly people: PeopleDirectoryPort,
    @Inject(MAILER) private readonly mailer: MailerPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @InjectPinoLogger(OnPaymentFailed.name) private readonly logger: PinoLogger,
  ) {}

  async handle(event: PaymentFailed): Promise<void> {
    const data = event.payload();

    const payer = await this.uow.read(() => this.invoices.findPayerContext(data.invoiceId));
    if (!payer) {
      this.logger.error(`Cobro fallido de la factura ${data.invoiceId}, pero no se encuentra para avisar.`);
      return;
    }

    const recipient = await resolveInvoicePayerRecipient({
      uow: this.uow,
      people: this.people,
      logger: this.logger,
      billToMembershipId: payer.billToMembershipId,
      studentId: payer.studentId,
      invoiceId: data.invoiceId,
      noRecipientReason: "No se envía el aviso de cobro fallido.",
    });
    if (!recipient) return;

    try {
      await this.mailer.send({
        to: recipient.email,
        locale: recipient.locale,
        template: "payment_failed",
        data: {
          name: recipient.name,
          number: payer.number,
          amountCents: data.amountCents,
          currency: data.currency,
          failureMessage: data.failureMessage,
        },
      });
      this.logger.info(`Aviso de cobro fallido de la factura ${data.invoiceId} enviado.`);
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error : new Error(String(error)) },
        `No se pudo avisar del cobro fallido de la factura ${data.invoiceId}: se reintentará.`,
      );
    }
  }
}
