import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import { ID_GENERATOR, type IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import { Lead } from "../../../domain/model/lead.aggregate.js";
import {
  LEAD_REPOSITORY,
  type LeadRepository,
} from "../../../domain/ports/lead.repository.port.js";
import {
  LEAD_CAPTURE_TENANT_RUNNER,
  type LeadCaptureTenantRunner,
} from "../../ports/lead-capture-tenant-runner.port.js";
import {
  PUBLISHED_SITE_RESOLVER,
  type PublishedSiteResolver,
} from "../../ports/published-site-resolver.port.js";
import { CaptureLeadCommand } from "./capture-lead.command.js";

@CommandHandler(CaptureLeadCommand)
export class CaptureLeadHandler implements ICommandHandler<CaptureLeadCommand> {
  constructor(
    @Inject(LEAD_REPOSITORY) private readonly leads: LeadRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(PUBLISHED_SITE_RESOLVER) private readonly sites: PublishedSiteResolver,
    @Inject(LEAD_CAPTURE_TENANT_RUNNER) private readonly runner: LeadCaptureTenantRunner,
  ) {}

  async execute(command: CaptureLeadCommand): Promise<{ leadId: string; status: string }> {
    if (command.props.siteId) {
      const schoolId = await this.sites.schoolIdForPublishedSite(command.props.siteId);
      if (!schoolId) throw new NotFoundError("sitio público", command.props.siteId);
      return this.runner.runWithSchool(schoolId, () => this.capture(command, schoolId));
    }

    return this.capture(command, this.tenant.schoolId());
  }

  private async capture(
    command: CaptureLeadCommand,
    schoolId: string,
  ): Promise<{ leadId: string; status: string }> {
    const now = this.clock.now();
    const lead = Lead.capture({
      id: this.ids.generate(),
      schoolId: SchoolId.of(schoolId),
      name: command.props.name,
      email: command.props.email,
      phone: command.props.phone ?? null,
      locale: command.props.locale ?? null,
      message: command.props.message ?? null,
      interestedLanguage: command.props.interestedLanguage ?? null,
      declaredLevel: command.props.declaredLevel ?? null,
      sourcePage: command.props.sourcePage ?? null,
      sourceCampaign: command.props.sourceCampaign ?? null,
      referrer: command.props.referrer ?? null,
      now,
    });

    await this.uow.execute(async () => {
      await this.leads.save(lead);
    });
    await this.events.publish(lead.pullDomainEvents());
    return { leadId: lead.id, status: lead.status };
  }
}
