import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { StudentId } from "../../../domain/model/identifiers.js";
import {
  STUDENT_REPOSITORY,
  type StudentRepository,
} from "../../../domain/ports/student.repository.port.js";
import { LeaveStudentCommand } from "./leave-student.command.js";

/**
 * Baja de un alumno.
 *
 * Leer, decidir y guardar van DENTRO de la misma transacción, igual que en
 * `CancelClassSessionHandler`: fuera de ella no hay contexto de escuela y dos
 * bajas simultáneas podrían pisarse.
 */
@CommandHandler(LeaveStudentCommand)
export class LeaveStudentHandler implements ICommandHandler<LeaveStudentCommand> {
  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: LeaveStudentCommand) {
    const student = await this.uow.execute(async () => {
      const found = await this.students.findOrFail(StudentId.of(command.props.studentId));
      found.leave({ reason: command.props.reason, now: this.clock.now() });
      await this.students.save(found);
      return found;
    });

    await this.events.publish(student.pullDomainEvents());
    return { studentId: student.id.value, status: student.status };
  }
}
