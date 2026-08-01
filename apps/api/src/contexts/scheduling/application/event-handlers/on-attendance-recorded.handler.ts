import { Inject } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { CLOCK, type Clock } from "../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../shared/domain/ports/event-publisher.port.js";
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from "../../../shared/domain/ports/unit-of-work.port.js";
import { AttendanceRecorded } from "../../domain/events/attendance.events.js";
import { SessionId } from "../../domain/model/identifiers.js";
import {
  CLASS_SESSION_REPOSITORY,
  type ClassSessionRepository,
} from "../../domain/ports/class-session.repository.port.js";

/**
 * Cierra la clase cuando la hoja de asistencia queda completa.
 *
 * Es un manejador dentro del MISMO contexto: `AttendanceSheet` y
 * `ClassSession` son dos agregados de `scheduling`, y el único camino entre
 * agregados es el evento — ni siquiera dentro de un contexto se llama al
 * repositorio del otro directamente desde el dominio.
 *
 *   · `AttendanceSheet` NO sabe que `ClassSession` existe. Calculó
 *     `sheetComplete` y `anyoneAttended` con lo que ya tenía delante (el
 *     padrón y sus propias entradas) y siguió.
 *   · Este manejador no vuelve a comprobar cobertura: confía en el evento,
 *     igual que Facturación confía en `refundDue` de `ClassSessionCanceled`.
 *   · Si la clase ya estaba cerrada por otra vía (se canceló mientras se
 *     pasaba lista), no se relanza `complete()`: se registra y no se hace
 *     nada más.
 */
@EventsHandler(AttendanceRecorded)
export class OnAttendanceRecorded implements IEventHandler<AttendanceRecorded> {
  constructor(
    @Inject(CLASS_SESSION_REPOSITORY) private readonly sessions: ClassSessionRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
    @InjectPinoLogger(OnAttendanceRecorded.name) private readonly logger: PinoLogger,
  ) {}

  async handle(event: AttendanceRecorded): Promise<void> {
    const data = event.payload();
    if (!data.sheetComplete) return;

    const session = await this.uow.execute(async () => {
      const found = await this.sessions.findOrFail(SessionId.of(data.sessionId));
      if (!found.isOpen) return null;

      found.complete({ now: this.clock.now(), anyoneAttended: data.anyoneAttended });
      await this.sessions.save(found);
      return found;
    });

    if (!session) {
      this.logger.info(
        `Asistencia completa de la clase ${data.sessionId}, pero ya estaba cerrada por otra vía.`,
      );
      return;
    }

    // Después de confirmar: si la transacción se hubiera deshecho, nadie
    // debería enterarse de un cierre que no llegó a pasar.
    await this.events.publish(session.pullDomainEvents());
    this.logger.info(`Clase ${data.sessionId} cerrada tras completar la asistencia: ${session.status}.`);
  }
}
