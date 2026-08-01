import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { TeacherId } from "../../../domain/model/identifiers.js";
import {
  TEACHER_REPOSITORY,
  type TeacherRepository,
} from "../../../domain/ports/teacher.repository.port.js";
import { ReleaseTeacherCommand } from "./release-teacher.command.js";

/**
 * Baja de un profesor.
 *
 * Igual patrón que `LeaveStudentHandler`. Un profesor de baja deja de
 * aparecer como disponible para `scheduling` (`TeacherAvailabilityPort.isActive`
 * consulta este mismo `status`), pero sus clases pasadas no se tocan: viven
 * en el agregado `ClassSession`, que este manejador ni conoce.
 */
@CommandHandler(ReleaseTeacherCommand)
export class ReleaseTeacherHandler implements ICommandHandler<ReleaseTeacherCommand> {
  constructor(
    @Inject(TEACHER_REPOSITORY) private readonly teachers: TeacherRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: ReleaseTeacherCommand) {
    const teacher = await this.uow.execute(async () => {
      const found = await this.teachers.findOrFail(TeacherId.of(command.props.teacherId));
      found.release({ reason: command.props.reason, now: this.clock.now() });
      await this.teachers.save(found);
      return found;
    });

    await this.events.publish(teacher.pullDomainEvents());
    return { teacherId: teacher.id.value, status: teacher.status };
  }
}
