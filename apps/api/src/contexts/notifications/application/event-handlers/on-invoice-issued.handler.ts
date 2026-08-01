import { Inject } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { InvoiceIssued } from "../../../billing/domain/events/invoice.events.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { INVOICE_DIRECTORY, type InvoiceDirectoryPort } from "../../domain/ports/invoice-directory.port.js";
import { MAILER, type MailerPort } from "../../domain/ports/mailer.port.js";
import { PEOPLE_DIRECTORY, type PeopleDirectoryPort } from "../../domain/ports/people-directory.port.js";
import { resolveInvoicePayerRecipient } from "./resolve-invoice-payer-recipient.js";

/**
 * `notifications` reacciona a que se emita una factura avisando a quien
 * paga: el alumno adulto, o el tutor si es menor.
 *
 * Solo facturas `school_to_student`: una `platform_to_school` es tu cobro a
 * la escuela, no algo que le corresponda leer a un alumno o a un tutor.
 *
 * `InvoiceIssued.payload()` no lleva `billToMembershipId` ni `studentId`
 * —esos campos no le hacen falta al resto de su contrato—, así que
 * `InvoiceDirectoryPort` es la única forma de saber a quién escribir.
 */
@EventsHandler(InvoiceIssued)
export class OnInvoiceIssued implements IEventHandler<InvoiceIssued> {
  constructor(
    @Inject(INVOICE_DIRECTORY) private readonly invoices: InvoiceDirectoryPort,
    @Inject(PEOPLE_DIRECTORY) private readonly people: PeopleDirectoryPort,
    @Inject(MAILER) private readonly mailer: MailerPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @InjectPinoLogger(OnInvoiceIssued.name) private readonly logger: PinoLogger,
  ) {}

  async handle(event: InvoiceIssued): Promise<void> {
    const data = event.payload();
    if (data.direction !== "school_to_student") return;

    const payer = await this.uow.read(() => this.invoices.findPayerContext(data.invoiceId));
    if (!payer) {
      this.logger.error(`Factura ${data.invoiceId} emitida, pero no se encuentra para resolver a quién avisar.`);
      return;
    }

    const recipient = await resolveInvoicePayerRecipient({
      uow: this.uow,
      people: this.people,
      logger: this.logger,
      billToMembershipId: payer.billToMembershipId,
      studentId: payer.studentId,
      invoiceId: data.invoiceId,
      noRecipientReason: "No se envía el aviso de factura emitida.",
    });
    if (!recipient) return;

    try {
      await this.mailer.send({
        to: recipient.email,
        locale: recipient.locale,
        template: "invoice_issued",
        data: {
          name: recipient.name,
          number: data.number,
          totalCents: data.totalCents,
          currency: data.currency,
          dueOn: payer.dueOn ? payer.dueOn.toISOString() : null,
        },
      });
      this.logger.info(`Aviso de factura ${data.invoiceId} enviado.`);
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error : new Error(String(error)) },
        `No se pudo avisar de la factura ${data.invoiceId}: se reintentará.`,
      );
    }
  }
}
