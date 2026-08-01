import { Controller, Get, UseGuards } from "@nestjs/common";
import { CronSecretGuard } from "../../../shared/infrastructure/http/cron-secret.guard.js";
import { Public } from "../../../shared/infrastructure/http/roles.decorator.js";
import { ClassReminderJob } from "../../application/jobs/class-reminder.job.js";

/**
 * Entrada HTTP del recordatorio de clase para Vercel Cron, donde los
 * `@Cron(...)` de `@nestjs/schedule` no se disparan (la función está
 * congelada entre invocaciones). En un proceso largo esta ruta no se usa:
 * el trabajo se dispara solo cada hora, como siempre.
 *
 * `@Public()` porque no hay sesión que resolver —el trabajo fija su propio
 * tenant escuela a escuela, igual que cuando lo dispara el planificador—;
 * el control de acceso es `CronSecretGuard`.
 */
@Controller("cron")
export class NotificationsCronController {
  constructor(private readonly classReminder: ClassReminderJob) {}

  @Public()
  @UseGuards(CronSecretGuard)
  @Get("class-reminder")
  async classReminders(): Promise<{ ok: true }> {
    await this.classReminder.run();
    return { ok: true };
  }
}
