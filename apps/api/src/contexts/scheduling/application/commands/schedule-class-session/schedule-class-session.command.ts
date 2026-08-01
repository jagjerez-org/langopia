import { Command } from "@nestjs/cqrs";

/**
 * Comando: una intención, en imperativo. Puede ser rechazada.
 *
 * Lleva primitivos, no objetos de dominio: lo construye un adaptador de
 * entrada (un controlador HTTP, una herramienta MCP, un consumidor de cola)
 * que no conoce el dominio. Es el manejador quien traduce a value objects, y
 * ahí es donde se validan.
 *
 * El genérico de `Command` declara qué devuelve: el id de lo creado, nunca
 * el agregado entero.
 */
export class ScheduleClassSessionCommand extends Command<{ sessionId: string }> {
  constructor(
    readonly props: {
      groupId: string;
      teacherId: string | null;
      startsAt: string;
      durationMinutes: number;
      roomProvider: string;
      roomUrl?: string | null;
      roomExternalId?: string | null;
      topic?: string | null;
      contentUnitId?: string | null;
      /** Saltarse la comprobación de disponibilidad declarada. Solo dirección. */
      overrideAvailability?: boolean;
    },
  ) {
    super();
  }
}
