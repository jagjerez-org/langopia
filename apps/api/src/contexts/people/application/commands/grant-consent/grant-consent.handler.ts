import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { MembershipId } from "../../../../shared/domain/primitives/school-id.js";
import { StudentId } from "../../../domain/model/identifiers.js";
import {
  STUDENT_REPOSITORY,
  type StudentRepository,
} from "../../../domain/ports/student.repository.port.js";
import { GrantConsentCommand } from "./grant-consent.command.js";

/**
 * Concede un consentimiento.
 *
 * El propio agregado decide si quien firma puede hacerlo: `Student.grantConsent`
 * rechaza que un menor firme el suyo y exige que, si lo es, firme un tutor
 * con `canGiveConsent`. Este manejador no repite esa comprobación — se
 * limitaría a duplicarla y un día dejarían de coincidir.
 */
@CommandHandler(GrantConsentCommand)
export class GrantConsentHandler implements ICommandHandler<GrantConsentCommand> {
  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: GrantConsentCommand) {
    const student = await this.uow.execute(async () => {
      const found = await this.students.findOrFail(StudentId.of(command.props.studentId));
      found.grantConsent({
        kind: command.props.kind,
        grantedBy: MembershipId.of(command.props.grantedByMembershipId),
        now: this.clock.now(),
      });
      await this.students.save(found);
      return found;
    });

    await this.events.publish(student.pullDomainEvents());
    return { studentId: student.id.value, kind: command.props.kind, granted: true };
  }
}
