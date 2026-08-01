import { Inject } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { ClassSessionScheduled } from "../../../scheduling/domain/events/class-session.events.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { RoomProvider } from "../../domain/model/room-provider.js";
import { ROOM_PROVIDER_PORT, type RoomProviderPort } from "../../domain/ports/room-provider.port.js";
import { SESSION_ROOM_PORT, type SessionRoomPort } from "../../domain/ports/session-room.port.js";

/**
 * `classroom` reacciona a que se programe una clase creando su sala.
 *
 *   · Scheduling NO sabe que `classroom` existe. Emitió un hecho y siguió.
 *   · `classroom` NO puede impedir que la clase se programe. Si pudiera, esto
 *     no sería un evento: sería una llamada síncrona por un puerto, y una
 *     integración de vídeo caída bloquearía dar de alta una clase presencial.
 *   · Por eso un fallo del proveedor (Zoom, Meet, Teams sin OAuth conectado)
 *     nunca lanza: `createRoom()` devuelve `pending` y este manejador se
 *     limita a registrarlo. La clase ya existe pase lo que pase aquí.
 *
 * Lo único que se importa del otro contexto es la CLASE DEL EVENTO — su
 * contrato público — nunca su agregado, sus objetos de valor ni su
 * repositorio.
 */
@EventsHandler(ClassSessionScheduled)
export class OnClassSessionScheduled implements IEventHandler<ClassSessionScheduled> {
  constructor(
    @Inject(ROOM_PROVIDER_PORT) private readonly rooms: RoomProviderPort,
    @Inject(SESSION_ROOM_PORT) private readonly sessionRooms: SessionRoomPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @InjectPinoLogger(OnClassSessionScheduled.name) private readonly logger: PinoLogger,
  ) {}

  async handle(event: ClassSessionScheduled): Promise<void> {
    const data = event.payload();
    const provider = data.roomProvider;

    // Presencial no tiene sala que crear.
    if (provider === RoomProvider.InPerson) return;

    const result = await this.rooms.createRoom({
      sessionId: data.sessionId,
      schoolId: event.schoolId,
      provider,
      start: new Date(data.start),
      end: new Date(data.end),
    });

    if (result.status === "pending") {
      this.logger.warn(
        `Sala de la clase ${data.sessionId} (${provider}) pendiente: ${result.reason}`,
      );
      return;
    }

    // Escribir dentro de la unidad de trabajo: fuera de ella no hay contexto
    // de escuela y RLS no dejaría actualizar la fila.
    await this.uow.execute(() =>
      this.sessionRooms.attachRoom({
        sessionId: data.sessionId,
        url: result.url,
        externalId: result.externalId,
      }),
    );

    this.logger.info(`Sala de la clase ${data.sessionId} creada en ${provider}: ${result.url}`);
  }
}
