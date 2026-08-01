import { Command } from "@nestjs/cqrs";

/**
 * Traduce `charge.refunded` (o el evento equivalente de cualquier otro
 * proveedor) a un hecho ya conocido: una devolución que registramos como
 * pendiente se confirmó.
 *
 * Igual que `ReconcilePaymentCommand`, del lado de las devoluciones:
 * idempotente por diseño, no revierte nada en el proveedor —eso ya ocurrió—,
 * solo pone al día lo que `RefundPaymentHandler` había dejado `pending`.
 */
export class ReconcileRefundCommand extends Command<{
  applied: boolean;
  invoiceId: string | null;
  feeReversedCents: number | null;
}> {
  constructor(
    readonly props: {
      refundRef: string;
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
