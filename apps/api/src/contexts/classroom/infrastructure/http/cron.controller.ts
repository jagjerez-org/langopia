import { Controller, Get, UseGuards } from "@nestjs/common";
import { CronSecretGuard } from "../../../shared/infrastructure/http/cron-secret.guard.js";
import { Public } from "../../../shared/infrastructure/http/roles.decorator.js";
import { ImportExternalTranscriptsJob } from "../../application/jobs/import-external-transcripts.job.js";
import { PurgeExpiredRecordingsJob } from "../../application/jobs/purge-expired-recordings.job.js";

/**
 * Entradas HTTP de los trabajos de `classroom` para Vercel Cron, donde los
 * `@Cron(...)` de `@nestjs/schedule` no se disparan (la función está
 * congelada entre invocaciones). En un proceso largo estas rutas no se
 * usan: los trabajos se disparan solos, como siempre.
 *
 * `@Public()` porque no hay sesión que resolver —cada trabajo fija su
 * propio tenant—; el control de acceso es `CronSecretGuard`.
 */
@Controller("cron")
export class ClassroomCronController {
  constructor(
    private readonly importExternalTranscripts: ImportExternalTranscriptsJob,
    private readonly purgeExpiredRecordings: PurgeExpiredRecordingsJob,
  ) {}

  @Public()
  @UseGuards(CronSecretGuard)
  @Get("import-external-transcripts")
  async importTranscripts(): Promise<{ ok: true }> {
    await this.importExternalTranscripts.run();
    return { ok: true };
  }

  @Public()
  @UseGuards(CronSecretGuard)
  @Get("purge-expired-recordings")
  async purgeRecordings(): Promise<{ ok: true }> {
    await this.purgeExpiredRecordings.run();
    return { ok: true };
  }
}
