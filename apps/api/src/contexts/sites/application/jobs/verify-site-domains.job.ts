import { Inject, Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { CLOCK, type Clock } from "../../../shared/domain/ports/clock.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import {
  SYSTEM_TENANT_RUNNER,
  type SystemTenantRunner,
} from "../ports/system-tenant-runner.port.js";
import { DNS_VERIFIER, type DnsVerifierPort } from "../../domain/ports/dns-verifier.port.js";
import {
  SITE_DOMAIN_REPOSITORY,
  type SiteDomainRepository,
} from "../../domain/ports/site-domain.repository.port.js";
import { TLS_ISSUER, type TlsIssuerPort } from "../../domain/ports/tls-issuer.port.js";

export type VerifySiteDomainsResult = { checked: number; verified: number; failed: number };

@Injectable()
export class VerifySiteDomainsJob {
  constructor(
    @Inject(SITE_DOMAIN_REPOSITORY) private readonly domains: SiteDomainRepository,
    @Inject(DNS_VERIFIER) private readonly dns: DnsVerifierPort,
    @Inject(TLS_ISSUER) private readonly tls: TlsIssuerPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(SYSTEM_TENANT_RUNNER) private readonly tenants: SystemTenantRunner,
    @Inject(CLOCK) private readonly clock: Clock,
    @InjectPinoLogger(VerifySiteDomainsJob.name) private readonly logger: PinoLogger,
  ) {}

  @Cron("*/15 * * * *")
  async run(): Promise<void> {
    const result = await this.verifyPendingDomains();
    this.logger.info(
      `Dominios propios: ${result.checked} comprobado(s), ${result.verified} verificado(s), ${result.failed} fallido(s).`,
    );
  }

  async verifyPendingDomains(): Promise<VerifySiteDomainsResult> {
    const now = this.clock.now();
    const pending = await this.domains.pendingBefore(now);
    const result: VerifySiteDomainsResult = { checked: 0, verified: 0, failed: 0 };

    for (const domain of pending) {
      result.checked++;
      await this.tenants.runWithSchool(domain.schoolId, async () => {
        await this.uow.execute(async () => {
          let records: readonly string[] = [];
          try {
            records = await this.dns.resolveTxt(domain.verificationInstruction.name);
          } catch (error) {
            this.logger.warn(`No se pudo consultar DNS de ${domain.hostname}: ${String(error)}.`);
          }

          const statusBefore: string = domain.status;
          if (domain.verifyDns(records, now)) {
            const certificate = await this.tls.issueCertificate(domain.hostname);
            if (certificate.issued) domain.markTlsIssued(now);
            else domain.markTlsNoop();
            result.verified++;
          } else if (
            domain.markFailedIfExpired(now) ||
            (statusBefore === "pending" && domain.status === "failed")
          ) {
            result.failed++;
          }

          await this.domains.save(domain);
        });
      });
    }

    return result;
  }
}
