import { Injectable } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import type { DomainEvent } from "../../domain/events/domain-event.js";
import type { EventPublisher } from "../../domain/ports/event-publisher.port.js";

/**
 * Publicación de eventos de dominio sobre el bus de NestJS.
 *
 * Aquí, en la infraestructura, es donde se decide CÓMO viajan los eventos
 * entre contextos. Hoy es un bus en memoria: sencillo, síncrono dentro del
 * proceso y suficiente mientras la API sea un despliegue.
 *
 * El día que un contexto salga a su propio servicio, se cambia esta clase por
 * un adaptador a Redis o SQS y no se toca ni un manejador ni un agregado. Esa
 * es toda la razón de que este puerto exista.
 *
 * Un fallo al publicar NO deshace la operación: la transacción ya se
 * confirmó. Se registra para poder reintentarlo, porque perder un evento en
 * silencio significa una devolución que nunca se abre.
 */
@Injectable()
export class NestEventPublisher implements EventPublisher {
  constructor(
    private readonly bus: EventBus,
    @InjectPinoLogger(NestEventPublisher.name) private readonly logger: PinoLogger,
  ) {}

  async publish(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      try {
        this.bus.publish(event);
      } catch (error) {
        this.logger.error(
          { err: error instanceof Error ? error : new Error(String(error)) },
          `No se pudo publicar ${event.eventName} de ${event.aggregateId}`,
        );
      }
    }
  }
}
