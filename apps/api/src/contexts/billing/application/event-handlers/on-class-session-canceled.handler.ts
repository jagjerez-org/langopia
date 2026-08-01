import { Inject } from "@nestjs/common";
import { CommandBus, EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { ClassSessionCanceled } from "../../../scheduling/domain/events/class-session.events.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import {
  INVOICE_REPOSITORY,
  type InvoiceRepository,
} from "../../domain/ports/invoice.repository.port.js";
import { RefundPaymentCommand } from "../commands/refund-payment/refund-payment.command.js";

/**
 * Facturación reacciona a que se cancele una clase.
 *
 *   · Scheduling NO sabe que Facturación existe. Emitió un hecho y siguió.
 *   · Facturación NO decide si toca devolver. Esa regla es de Scheduling y
 *     viene ya resuelta en `refundDue`, calculada por la política de
 *     cancelación de la escuela en el momento de cancelar.
 *   · Facturación tampoco puede impedir la cancelación. Si pudiera, esto no
 *     sería un evento: sería una llamada síncrona por un puerto.
 *
 * Lo único que se importa del otro contexto es la CLASE DEL EVENTO, que es
 * su contrato público. Nunca su agregado, ni sus objetos de valor, ni su
 * repositorio.
 *
 * Cuando SÍ procede devolución, este manejador busca qué cobros reales cubren
 * esta sesión (`findPaidChargesForSession`: la línea que corresponde a ESTA
 * clase dentro de la factura de CADA matriculado, no el total de ninguna) y
 * abre una devolución por cada uno con `RefundPaymentCommand` — el mismo
 * comando que usaría un administrador desde el panel, así que la regla «no se
 * puede devolver más de lo cobrado» y la reversión proporcional de comisión
 * se aplican exactamente igual aquí que allí. Si la clase nunca llegó a
 * cobrarse (factura todavía sin pagar, o sin emitir), no hay nada que
 * devolver y se deja constancia en el log.
 *
 * Sobre el fallo: este manejador corre DESPUÉS de que la transacción de
 * Scheduling se haya confirmado. Si falla, la clase queda cancelada y la
 * devolución no se abre — así que no puede quedarse en un `catch` silencioso.
 * Cuando esto pase de esqueleto a implementación con reintentos reales, va a
 * una cola con cola de fallidos.
 */
@EventsHandler(ClassSessionCanceled)
export class OnClassSessionCanceled implements IEventHandler<ClassSessionCanceled> {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly invoices: InvoiceRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly commands: CommandBus,
    @InjectPinoLogger(OnClassSessionCanceled.name) private readonly logger: PinoLogger,
  ) {}

  async handle(event: ClassSessionCanceled): Promise<void> {
    const data = event.payload();

    if (!data.refundDue) {
      this.logger.info(
        `Clase ${data.sessionId} cancelada con ${data.noticeHours} h de antelación: sin devolución.`,
      );
      return;
    }

    const charges = await this.uow.read(() =>
      this.invoices.findPaidChargesForSession(data.sessionId),
    );

    if (charges.length === 0) {
      this.logger.info(
        `Clase ${data.sessionId} cancelada por ${data.party}: procedía devolución, pero no hay ` +
          "ningún cobro registrado que devolver (factura sin pagar o sin emitir todavía).",
      );
      return;
    }

    // Una devolución POR MATRICULADO: una clase de grupo se cobra en tantas
    // facturas como personas haya en ella. Se recorren todas aunque alguna
    // falle —dejar a seis sin devolución porque la séptima dio error sería
    // peor— y el primer error se relanza al final: este manejador no puede
    // tragarse un fallo en silencio.
    let firstError: unknown = null;

    for (const charge of charges) {
      try {
        await this.commands.execute(
          new RefundPaymentCommand({
            invoiceId: charge.invoiceId,
            amountCents: charge.lineAmountCents,
            reason: "service_not_provided",
            // Determinista por sesión Y POR FACTURA: reintentar este mismo
            // evento no abre una segunda devolución, y dos matriculados de la
            // misma clase no comparten clave — si la compartieran, el
            // proveedor de pago trataría la segunda como un reintento de la
            // primera y solo devolvería a una persona.
            idempotencyKey: `refund-session-${data.sessionId}-${charge.invoiceId}`,
          }),
        );

        this.logger.info(
          `Clase ${data.sessionId} cancelada por ${data.party}: devolución de ` +
            `${charge.lineAmountCents} céntimos abierta contra el cobro ${charge.paymentId}.`,
        );
      } catch (error) {
        firstError ??= error;
        this.logger.error(
          { err: error },
          `Clase ${data.sessionId} cancelada por ${data.party}: no se pudo abrir la devolución de ` +
            `la factura ${charge.invoiceId}.`,
        );
      }
    }

    if (firstError) throw firstError;
  }
}
