import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import { ID_GENERATOR, type IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { EnrollmentId, GroupId, StudentId } from "../../../domain/model/identifiers.js";
import {
  GROUP_REPOSITORY,
  type GroupRepository,
} from "../../../domain/ports/group.repository.port.js";
import {
  STUDENT_STATUS_PORT,
  type StudentStatusPort,
} from "../../../domain/ports/student-status.port.js";
import { EnrolStudentInGroupCommand } from "./enrol-student-in-group.command.js";

/**
 * Matricula a un alumno en un grupo.
 *
 * Si el alumno está de baja se comprueba aquí, con `StudentStatusPort` —la
 * capa anticorrupción hacia `people`—, y el HECHO ya resuelto (`studentActive`)
 * se le pasa a `Group.enrol()`: el agregado no consulta nada por sí mismo.
 */
@CommandHandler(EnrolStudentInGroupCommand)
export class EnrolStudentInGroupHandler implements ICommandHandler<EnrolStudentInGroupCommand> {
  constructor(
    @Inject(GROUP_REPOSITORY) private readonly groups: GroupRepository,
    @Inject(STUDENT_STATUS_PORT) private readonly studentStatus: StudentStatusPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: EnrolStudentInGroupCommand): Promise<{ enrollmentId: string }> {
    const { props } = command;
    const now = this.clock.now();
    const studentId = StudentId.of(props.studentId);

    const group = await this.uow.execute(async () => {
      const found = await this.groups.findOrFail(GroupId.of(props.groupId));
      const studentActive = await this.studentStatus.isActive(studentId);

      found.enrol({
        enrollmentId: EnrollmentId.of(this.ids.generate()),
        studentId,
        studentActive,
        agreedPriceCents: props.agreedPriceCents ?? null,
        now,
      });

      await this.groups.save(found);
      return found;
    });

    // Después de confirmar: si la transacción se hubiera deshecho, nadie
    // debería haberse enterado de una matrícula que no existe.
    const events = group.pullDomainEvents();
    await this.events.publish(events);

    const enrolled = group.enrollments[group.enrollments.length - 1]!;
    return { enrollmentId: enrolled.id.value };
  }
}
