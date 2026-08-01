import type { PaymentProvider } from "./payment-gateway.port.js";

/**
 * Registro de los avisos del proveedor de pago que YA se procesaron.
 *
 * Existe porque los proveedores reenvían eventos por diseño: la misma entrega
 * puede llegar dos veces, y a la vez. Sin esto, dos entregas simultáneas de
 * `payment_intent.succeeded` reconciliaban el mismo cobro dos veces y emitían
 * dos recibos —con el mismo número— y dos correos a quien paga.
 */
export interface ProcessedWebhookEvents {
  /**
   * Reclama el evento para ESTA transacción. `true` si es la primera vez que
   * se procesa; `false` si ya lo había reclamado otra entrega.
   *
   * Se llama DENTRO de la transacción que aplica los efectos, y la primera:
   * así, o se guardan la marca y los efectos juntos, o no se guarda ninguno de
   * los dos. Reclamar en una transacción aparte perdería el evento para
   * siempre si la que aplica los efectos fallara después.
   */
  claim(params: {
    schoolId: string;
    provider: PaymentProvider;
    eventId: string;
    eventType: string;
  }): Promise<boolean>;
}

export const PROCESSED_WEBHOOK_EVENTS = Symbol("ProcessedWebhookEvents");
