import type { DomainEvent } from "../events/domain-event.js";

/**
 * Publicador de eventos de dominio.
 *
 * Es la vía por la que un contexto avisa a los demás sin conocerlos. Quien
 * publica no sabe quién escucha, y quien escucha no puede impedir la acción
 * original —si eso hiciera falta, no es un evento: es una llamada síncrona a
 * través de un puerto.
 *
 * La implementación publica DESPUÉS de confirmar la transacción.
 */
export interface EventPublisher {
  publish(events: DomainEvent[]): Promise<void>;
}

export const EVENT_PUBLISHER = Symbol("EventPublisher");
