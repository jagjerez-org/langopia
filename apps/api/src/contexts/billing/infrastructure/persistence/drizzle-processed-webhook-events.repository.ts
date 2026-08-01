import { Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { PaymentProvider } from "../../domain/ports/payment-gateway.port.js";
import type { ProcessedWebhookEvents } from "../../domain/ports/processed-webhook-events.port.js";

/**
 * La marca de «este evento ya se procesó», sobre `payment_webhook_events`.
 *
 * `ON CONFLICT DO NOTHING` sobre el índice único (`provider`, `event_id`) es
 * justo la primitiva que hace falta:
 *
 *   · Si otra entrega del mismo evento ya lo reclamó y confirmó, no se inserta
 *     nada y la fila devuelta es ninguna → `false`, y quien llama no repite el
 *     trabajo.
 *   · Si otra entrega lo reclamó y su transacción sigue abierta, Postgres HACE
 *     ESPERAR a esta hasta que la primera termine; si confirma, tampoco se
 *     inserta nada. Dos entregas simultáneas quedan serializadas sin que
 *     ninguna vea a medias el trabajo de la otra.
 *   · Si la transacción de la primera se deshace, la marca se va con ella y el
 *     reintento del proveedor vuelve a poder procesarlo. La marca y los
 *     efectos viven o mueren juntos.
 */
@Injectable()
export class DrizzleProcessedWebhookEvents implements ProcessedWebhookEvents {
  constructor(private readonly drizzle: DrizzleService) {}

  async claim(params: {
    schoolId: string;
    provider: PaymentProvider;
    eventId: string;
    eventType: string;
  }): Promise<boolean> {
    const inserted = await this.drizzle.db
      .insert(schema.paymentWebhookEvents)
      .values({
        schoolId: params.schoolId,
        provider: params.provider,
        eventId: params.eventId,
        eventType: params.eventType,
      })
      .onConflictDoNothing({
        target: [schema.paymentWebhookEvents.provider, schema.paymentWebhookEvents.eventId],
      })
      .returning({ id: schema.paymentWebhookEvents.id });

    return inserted.length > 0;
  }
}
