import { Inject } from "@nestjs/common";
import { Command, CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import { ID_GENERATOR, type IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import { TENANT_CONTEXT, type TenantContext } from "../../../../shared/domain/ports/tenant-context.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { DuplicateSiteDomainError } from "../../../domain/errors/sites.errors.js";
import { SiteDomain, normalizeHostname, type SiteDomainView } from "../../../domain/model/site-domain.entity.js";
import {
  SITE_DOMAIN_REPOSITORY,
  type SiteDomainRepository,
} from "../../../domain/ports/site-domain.repository.port.js";
import {
  SITE_DOMAIN_TOKEN_GENERATOR,
  type SiteDomainTokenGenerator,
} from "../../../domain/ports/site-domain-token-generator.port.js";

export class AddDomainCommand extends Command<SiteDomainView> {
  constructor(readonly props: { hostname: string }) {
    super();
  }
}

@CommandHandler(AddDomainCommand)
export class AddDomainHandler implements ICommandHandler<AddDomainCommand> {
  constructor(
    @Inject(SITE_DOMAIN_REPOSITORY) private readonly domains: SiteDomainRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(SITE_DOMAIN_TOKEN_GENERATOR) private readonly tokens: SiteDomainTokenGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: AddDomainCommand): Promise<SiteDomainView> {
    const hostname = normalizeHostname(command.props.hostname);
    return this.uow.execute(async () => {
      if (await this.domains.existsByHostname(hostname)) {
        throw new DuplicateSiteDomainError(hostname);
      }
      const domain = SiteDomain.request({
        id: this.ids.generate(),
        schoolId: this.tenant.schoolId(),
        hostname,
        verificationToken: this.tokens.generate(),
        now: this.clock.now(),
      });
      await this.domains.save(domain);
      return domain.toView();
    });
  }
}
