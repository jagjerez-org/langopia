import { Controller, Get, UseGuards } from "@nestjs/common";
import { CronSecretGuard } from "../../../shared/infrastructure/http/cron-secret.guard.js";
import { Public } from "../../../shared/infrastructure/http/roles.decorator.js";
import { NotifyOverdueAttemptsJob } from "../../application/jobs/notify-overdue-attempts.job.js";

/**
 * Entrada HTTP del aviso de intentos vencidos para Vercel Cron, donde los
 * `@Cron(...)` de `@nestjs/schedule` no se disparan (la función está
 * congelada entre invocaciones). En un proceso largo esta ruta no se usa:
 * el trabajo se dispara solo cada madrugada, como siempre.
 *
 * `@Public()` porque no hay sesión que resolver; el control de acceso es
 * `CronSecretGuard`.
 */
@Controller("cron")
export class AssessmentCronController {
  constructor(private readonly notifyOverdueAttempts: NotifyOverdueAttemptsJob) {}

  @Public()
  @UseGuards(CronSecretGuard)
  @Get("notify-overdue-attempts")
  async notifyOverdue(): Promise<{ ok: true }> {
    await this.notifyOverdueAttempts.run();
    return { ok: true };
  }
}
