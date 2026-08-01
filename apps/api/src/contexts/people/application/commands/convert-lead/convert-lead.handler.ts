import { Inject } from "@nestjs/common";
import { CommandBus, CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { LeadId } from "../../../domain/model/identifiers.js";
import {
  LEAD_REPOSITORY,
  type LeadRepository,
} from "../../../domain/ports/lead.repository.port.js";
import { EnrolStudentCommand } from "../enrol-student/enrol-student.command.js";
import { ConvertLeadCommand } from "./convert-lead.command.js";

@CommandHandler(ConvertLeadCommand)
export class ConvertLeadHandler implements ICommandHandler<ConvertLeadCommand> {
  constructor(
    @Inject(LEAD_REPOSITORY) private readonly leads: LeadRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly commands: CommandBus,
  ) {}

  async execute(command: ConvertLeadCommand): Promise<{ leadId: string; studentId: string }> {
    const lead = await this.uow.read(() => this.leads.find(LeadId.of(command.props.leadId)));
    if (!lead) throw new NotFoundError("candidato", command.props.leadId);

    const enrolled = await this.commands.execute(
      new EnrolStudentCommand({
        name: lead.name,
        email: lead.email,
        dateOfBirth: command.props.dateOfBirth,
        nativeLanguage: command.props.nativeLanguage,
        targetLanguage: command.props.targetLanguage,
        locale: lead.locale,
        currentLevel: lead.placementLevel ?? lead.declaredLevel,
        guardian: command.props.guardian ?? null,
      }),
    );

    await this.uow.execute(async () => {
      lead.convert({ studentProfileId: enrolled.studentId, now: this.clock.now() });
      await this.leads.save(lead);
    });
    await this.events.publish(lead.pullDomainEvents());

    return { leadId: lead.id, studentId: enrolled.studentId };
  }
}
