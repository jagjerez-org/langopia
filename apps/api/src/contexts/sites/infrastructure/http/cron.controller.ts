import { Controller, Get, UseGuards } from "@nestjs/common";
import { CronSecretGuard } from "../../../shared/infrastructure/http/cron-secret.guard.js";
import { Public } from "../../../shared/infrastructure/http/roles.decorator.js";
import { VerifySiteDomainsJob } from "../../application/jobs/verify-site-domains.job.js";

/**
 * Entrada HTTP de la verificación de dominios para Vercel Cron, donde los
 * `@Cron(...)` de `@nestjs/schedule` no se disparan (la función está
 * congelada entre invocaciones). En un proceso largo esta ruta no se usa:
 * el trabajo se dispara solo cada 15 minutos, como siempre.
 *
 * `@Public()` porque no hay sesión que resolver; el control de acceso es
 * `CronSecretGuard`.
 */
@Controller("cron")
export class SitesCronController {
  constructor(private readonly verifySiteDomains: VerifySiteDomainsJob) {}

  @Public()
  @UseGuards(CronSecretGuard)
  @Get("verify-site-domains")
  async verifyDomains(): Promise<{ ok: true }> {
    await this.verifySiteDomains.run();
    return { ok: true };
  }
}
