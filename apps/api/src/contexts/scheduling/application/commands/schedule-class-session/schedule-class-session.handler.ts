import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import {
  ID_GENERATOR,
  type IdGenerator,
} from "../../../../shared/domain/ports/id-generator.port.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from "../../../../shared/domain/ports/unit-of-work.port.js";
import { SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import { ClassSession } from "../../../domain/model/class-session.aggregate.js";
import { GroupId, SessionId, TeacherId } from "../../../domain/model/identifiers.js";
import { Room, ROOM_PROVIDERS, type RoomProvider } from "../../../domain/model/room.vo.js";
import { TimeSlot } from "../../../domain/model/time-slot.vo.js";
import {
  TeacherNotAvailableError,
  TeacherOverlapError,
  UnknownRoomProviderError,
} from "../../../domain/errors/scheduling.errors.js";
import {
  CLASS_SESSION_REPOSITORY,
  type ClassSessionRepository,
} from "../../../domain/ports/class-session.repository.port.js";
import {
  TEACHER_AVAILABILITY_PORT,
  type TeacherAvailabilityPort,
} from "../../../domain/ports/teacher-availability.port.js";
import { ScheduleClassSessionCommand } from "./schedule-class-session.command.js";

/**
 * Manejador del comando.
 *
 * Su trabajo es coreografía, no reglas: traducir primitivos a dominio,
 * reunir lo que el agregado no puede consultar por sí mismo, pedirle que
 * actúe, guardar en una transacción y publicar los eventos después.
 *
 * Las dos comprobaciones que hace aquí —disponibilidad y solape— están aquí
 * y no en el agregado por un motivo concreto: necesitan consultar otras
 * clases y otro contexto. Un agregado que hace consultas deja de ser un
 * agregado.
 */
@CommandHandler(ScheduleClassSessionCommand)
export class ScheduleClassSessionHandler
  implements ICommandHandler<ScheduleClassSessionCommand>
{
  constructor(
    @Inject(CLASS_SESSION_REPOSITORY) private readonly sessions: ClassSessionRepository,
    @Inject(TEACHER_AVAILABILITY_PORT) private readonly teachers: TeacherAvailabilityPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: ScheduleClassSessionCommand): Promise<{ sessionId: string }> {
    const { props } = command;
    const now = this.clock.now();

    const slot = TimeSlot.fromDuration(new Date(props.startsAt), props.durationMinutes);
    const room = Room.of({
      provider: assertRoomProvider(props.roomProvider),
      url: props.roomUrl,
      externalId: props.roomExternalId,
    });
    const teacherId = props.teacherId ? TeacherId.of(props.teacherId) : null;

    // Comprobar y guardar en la misma transacción. Las comprobaciones leen de
    // la base de datos, así que necesitan el contexto de escuela; y si se
    // hicieran fuera, dos peticiones simultáneas podrían pasar ambas la
    // comprobación de solape y reservar la misma hora.
    const session = await this.uow.execute(async () => {
      if (teacherId) {
        await this.assertTeacherCanTake(teacherId, slot, props.overrideAvailability ?? false);
      }

      const created = ClassSession.schedule({
        id: SessionId.of(this.ids.generate()),
        schoolId: SchoolId.of(this.tenant.schoolId()),
        groupId: GroupId.of(props.groupId),
        teacherId,
        slot,
        room,
        topic: props.topic ?? null,
        contentUnitId: props.contentUnitId ?? null,
        now,
      });

      await this.sessions.save(created);
      return created;
    });

    // Después de confirmar: si la transacción se hubiera deshecho, nadie
    // debería haberse enterado de una clase que no existe.
    await this.events.publish(session.pullDomainEvents());

    return { sessionId: session.id.value };
  }

  private async assertTeacherCanTake(
    teacherId: TeacherId,
    slot: TimeSlot,
    overrideAvailability: boolean,
  ): Promise<void> {
    if (!(await this.teachers.isActive(teacherId))) {
      throw new TeacherNotAvailableError(teacherId.value, slot.start, slot.end);
    }

    // La disponibilidad declarada es una guía, no una ley: la dirección puede
    // saltársela para encajar una clase puntual. El solape, en cambio, no se
    // salta nunca — sería vender dos veces la misma hora.
    if (!overrideAvailability && !(await this.teachers.coversSlot(teacherId, slot))) {
      throw new TeacherNotAvailableError(teacherId.value, slot.start, slot.end);
    }

    const overlapping = await this.sessions.findOverlappingForTeacher({ teacherId, slot });
    const blocking = overlapping.find((s) => s.countsTowardsOccupancy);
    if (blocking) {
      throw new TeacherOverlapError(teacherId.value, blocking.id.value);
    }
  }
}

function assertRoomProvider(value: string): RoomProvider {
  if ((ROOM_PROVIDERS as readonly string[]).includes(value)) return value as RoomProvider;
  throw new UnknownRoomProviderError(value, ROOM_PROVIDERS);
}
