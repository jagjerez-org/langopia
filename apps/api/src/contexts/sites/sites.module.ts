import { Module } from "@nestjs/common";
import { AddDomainHandler } from "./application/commands/add-domain/add-domain.handler.js";
import { PublishSiteHandler, UnpublishSiteHandler } from "./application/commands/publish-site/publish-site.handler.js";
import { SaveSitePageBlocksHandler } from "./application/commands/save-page-blocks/save-page-blocks.handler.js";
import { VerifySiteDomainsJob } from "./application/jobs/verify-site-domains.job.js";
import { SITE_EDITOR_REPOSITORY } from "./application/ports/site-editor.repository.port.js";
import { SYSTEM_TENANT_RUNNER } from "./application/ports/system-tenant-runner.port.js";
import { GetEditableSiteHandler } from "./application/queries/get-editable-site/get-editable-site.handler.js";
import { ListDomainsHandler } from "./application/queries/list-domains/list-domains.handler.js";
import {
  GetPublicSiteByHostHandler,
  GetPublicSitePageHandler,
} from "./application/queries/get-site-by-host/get-public-site-by-host.handler.js";
import { DNS_VERIFIER } from "./domain/ports/dns-verifier.port.js";
import { SITE_DOMAIN_REPOSITORY } from "./domain/ports/site-domain.repository.port.js";
import { SITE_DOMAIN_TOKEN_GENERATOR } from "./domain/ports/site-domain-token-generator.port.js";
import { TLS_ISSUER } from "./domain/ports/tls-issuer.port.js";
import { NodeDnsVerifierAdapter } from "./infrastructure/external/dns-verifier.adapter.js";
import { NoopTlsIssuerAdapter } from "./infrastructure/external/noop-tls-issuer.adapter.js";
import { SiteDomainsController } from "./infrastructure/http/site-domains.controller.js";
import { SiteEditorController } from "./infrastructure/http/site-editor.controller.js";
import { PublicSitesController } from "./infrastructure/http/public-sites.controller.js";
import { SitesCronController } from "./infrastructure/http/cron.controller.js";
import { publicSiteReadModelProvider } from "./infrastructure/persistence/drizzle-public-site-read-model.js";
import { DrizzleSiteEditorRepository } from "./infrastructure/persistence/drizzle-site-editor.repository.js";
import { DrizzleSiteDomainRepository } from "./infrastructure/persistence/drizzle-site-domain.repository.js";
import { CryptoSiteDomainTokenGenerator } from "./infrastructure/system/site-domain-token-generator.adapter.js";
import { ClsSystemTenantRunner } from "./infrastructure/tenant/cls-system-tenant-runner.js";

const commandHandlers = [AddDomainHandler, PublishSiteHandler, SaveSitePageBlocksHandler, UnpublishSiteHandler];
const queryHandlers = [GetEditableSiteHandler, GetPublicSiteByHostHandler, GetPublicSitePageHandler, ListDomainsHandler];

@Module({
  controllers: [PublicSitesController, SiteDomainsController, SiteEditorController, SitesCronController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    VerifySiteDomainsJob,
    publicSiteReadModelProvider,
    { provide: SITE_DOMAIN_REPOSITORY, useClass: DrizzleSiteDomainRepository },
    { provide: SITE_EDITOR_REPOSITORY, useClass: DrizzleSiteEditorRepository },
    { provide: DNS_VERIFIER, useClass: NodeDnsVerifierAdapter },
    { provide: TLS_ISSUER, useClass: NoopTlsIssuerAdapter },
    { provide: SITE_DOMAIN_TOKEN_GENERATOR, useClass: CryptoSiteDomainTokenGenerator },
    { provide: SYSTEM_TENANT_RUNNER, useClass: ClsSystemTenantRunner },
  ],
})
export class SitesModule {}
