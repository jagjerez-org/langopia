import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import type { SiteDomainView } from "../../../domain/model/site-domain.entity.js";
import {
  SITE_DOMAIN_REPOSITORY,
  type SiteDomainRepository,
} from "../../../domain/ports/site-domain.repository.port.js";

export class ListDomainsQuery extends Query<SiteDomainView[]> {}

@QueryHandler(ListDomainsQuery)
export class ListDomainsHandler implements IQueryHandler<ListDomainsQuery> {
  constructor(
    @Inject(SITE_DOMAIN_REPOSITORY) private readonly domains: SiteDomainRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async execute(): Promise<SiteDomainView[]> {
    return this.uow.read(async () => {
      const domains = await this.domains.listForSchool();
      return domains.map((domain) => domain.toView());
    });
  }
}
