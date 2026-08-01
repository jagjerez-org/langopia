import { Command } from "@nestjs/cqrs";

/**
 * Traduce `payment_intent.succeeded` (o el evento equivalente de cualquier
 * otro proveedor) a un hecho ya conocido: un cobro que registramos como
 * pendiente se confirmó.
 *
 * No cobra nada — eso ya ocurrió, en el proveedor, antes de que este evento
 * llegara. Este comando solo pone al día lo que ya sabíamos, y es idempotente
 * a propósito (paso 5b del brief): procesarlo dos veces para el mismo
 * `chargeRef` cobra una sola vez.
 */
export class ReconcilePaymentCommand extends Command<{
  applied: boolean;
  invoiceId: string | null;
  invoiceStatus: string | null;
  receiptNumber: string | null;
}> {
  constructor(
    readonly props: {
      chargeRef: string;
      /**
       * El importe que dice el PROVEEDOR que se cobró, tal cual viene en el
       * evento. Manda sobre el que tuviéramos registrado: quien movió el
       * dinero fue él. `null` si el evento no lo trae.
       */
      amountCents?: number | null;
      /** La moneda del evento, ISO-4217 en mayúsculas. `null` con `amountCents`. */
      currency?: string | null;
      /**
       * El identificador del evento en el proveedor (`evt_…`). Lo que hace
       * idempotente una entrega repetida: se reclama una sola vez, dentro de
       * la misma transacción que aplica los efectos. `null` cuando el comando
       * no viene de un webhook.
       */
      eventId?: string | null;
      eventType?: string | null;
    },
  ) {
    super();
  }
}
