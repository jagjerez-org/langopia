import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import {
  LEAD_REPOSITORY,
  type LeadRepository,
} from "../../../domain/ports/lead.repository.port.js";
import {
  PEOPLE_READ_MODEL,
  type LeadFunnelItem,
  type PeopleReadModel,
} from "../../ports/people-read-model.port.js";

export class ListLeadsQuery extends Query<LeadFunnelItem[]> {}

@QueryHandler(ListLeadsQuery)
export class ListLeadsHandler implements IQueryHandler<ListLeadsQuery> {
  constructor(
    @Inject(PEOPLE_READ_MODEL) private readonly readModel: PeopleReadModel,
    @Inject(LEAD_REPOSITORY) private readonly leads: LeadRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(): Promise<LeadFunnelItem[]> {
    const cutoff = new Date(this.clock.now().getTime() - 30 * 24 * 60 * 60 * 1000);
    await this.uow.execute(() => this.leads.markColdCandidates(cutoff));
    return this.readModel.listLeads();
  }
}
