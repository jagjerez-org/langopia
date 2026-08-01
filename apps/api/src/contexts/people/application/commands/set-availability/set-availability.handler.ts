import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { TeacherId } from "../../../domain/model/identifiers.js";
import { WeeklyAvailability } from "../../../domain/model/weekly-availability.vo.js";
import {
  TEACHER_REPOSITORY,
  type TeacherRepository,
} from "../../../domain/ports/teacher.repository.port.js";
import { SetAvailabilityCommand } from "./set-availability.command.js";

/**
 * Reemplaza la disponibilidad semanal de un profesor.
 *
 * `WeeklyAvailability.of(...)` es quien comprueba que ninguna franja se
 * solape con otra del mismo día; este manejador no repite esa comprobación.
 * Leer, decidir y guardar van dentro de la misma transacción, igual que
 * `LeaveStudentHandler`.
 */
@CommandHandler(SetAvailabilityCommand)
export class SetAvailabilityHandler implements ICommandHandler<SetAvailabilityCommand> {
  constructor(
    @Inject(TEACHER_REPOSITORY) private readonly teachers: TeacherRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
  ) {}

  async execute(command: SetAvailabilityCommand) {
    const teacher = await this.uow.execute(async () => {
      const found = await this.teachers.findOrFail(TeacherId.of(command.props.teacherId));
      found.setAvailability(WeeklyAvailability.of(command.props.slots));
      await this.teachers.save(found);
      return found;
    });

    await this.events.publish(teacher.pullDomainEvents());
    return { teacherId: teacher.id.value, slots: teacher.availability.slots.length };
  }
}
