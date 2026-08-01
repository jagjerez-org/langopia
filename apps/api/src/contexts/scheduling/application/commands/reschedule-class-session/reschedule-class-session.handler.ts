import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import {
  CLOCK,
  type Clock,
} from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import {
  ID_GENERATOR,
  type IdGenerator,
} from "../../../../shared/domain/ports/id-generator.port.js";
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from "../../../../shared/domain/ports/unit-of-work.port.js";
import { SessionId, TeacherId } from "../../../domain/model/identifiers.js";
import {
  TeacherNotAvailableError,
  TeacherOverlapError,
} from "../../../domain/errors/scheduling.errors.js";
import {
  CLASS_SESSION_REPOSITORY,
  type ClassSessionRepository,
} from "../../../domain/ports/class-session.repository.port.js";
import {
  TEACHER_AVAILABILITY_PORT,
  type TeacherAvailabilityPort,
} from "../../../domain/ports/teacher-availability.port.js";
import { RescheduleClassSessionCommand } from "./reschedule-class-session.command.js";

/**
 * Replanificar.
 *
 * Produce DOS agregados: la original, cerrada como `rescheduled`, y su
 * sustituta. Las dos se guardan en la misma transacción, porque un calendario
 * con una clase movida a medias es peor que uno sin mover.
 */
@CommandHandler(RescheduleClassSessionCommand)
export class RescheduleClassSessionHandler implements ICommandHandler<RescheduleClassSessionCommand> {
  constructor(
    @Inject(CLASS_SESSION_REPOSITORY)
    private readonly sessions: ClassSessionRepository,
    @Inject(TEACHER_AVAILABILITY_PORT)
    private readonly teachers: TeacherAvailabilityPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: RescheduleClassSessionCommand) {
    const { props } = command;
    const { original, replacement } = await this.uow.execute(async () => {
      const original = await this.sessions.findOrFail(
        SessionId.of(props.sessionId),
      );

      const newSlot = original.slot.movedTo(new Date(props.newStartsAt));
      const teacherId =
        props.newTeacherId === undefined
          ? original.teacherId
          : props.newTeacherId
            ? TeacherId.of(props.newTeacherId)
            : null;

      if (teacherId) {
        if (!(await this.teachers.isActive(teacherId))) {
          throw new TeacherNotAvailableError(
            teacherId.value,
            newSlot.start,
            newSlot.end,
          );
        }
        if (
          !props.overrideAvailability &&
          !(await this.teachers.coversSlot(teacherId, newSlot))
        ) {
          throw new TeacherNotAvailableError(
            teacherId.value,
            newSlot.start,
            newSlot.end,
          );
        }
        // `excluding` evita que la clase que estamos moviendo choque consigo misma.
        const overlapping = await this.sessions.findOverlappingForTeacher({
          teacherId,
          slot: newSlot,
          excluding: original.id,
        });
        const blocking = overlapping.find((s) => s.countsTowardsOccupancy);
        if (blocking)
          throw new TeacherOverlapError(teacherId.value, blocking.id.value);
      }

      const replacement = original.rescheduleTo({
        newSessionId: SessionId.of(this.ids.generate()),
        newSlot,
        reason: props.reason,
        now: this.clock.now(),
        teacherId,
      });

      await this.sessions.saveMany([original, replacement]);
      return { original, replacement };
    });

    await this.events.publish([
      ...original.pullDomainEvents(),
      ...replacement.pullDomainEvents(),
    ]);

    return {
      originalSessionId: original.id.value,
      replacementSessionId: replacement.id.value,
    };
  }
}
