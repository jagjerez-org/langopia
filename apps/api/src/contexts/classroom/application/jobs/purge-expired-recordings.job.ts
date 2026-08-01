import { Inject, Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ClsService } from "nestjs-cls";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { AUDIT_LOG, type AuditLogPort } from "../../../shared/domain/ports/audit-log.port.js";
import { CLOCK, type Clock } from "../../../shared/domain/ports/clock.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { CLS_SCHOOL_ID } from "../../../shared/infrastructure/tenant/cls-tenant-context.js";
import {
  RECORDING_STORAGE,
  type RecordingStoragePort,
} from "../../domain/ports/recording-storage.port.js";
import { SCHOOL_DIRECTORY, type SchoolDirectoryPort } from "../../domain/ports/school-directory.port.js";
import {
  TRANSCRIPT_REPOSITORY,
  type TranscriptRepositoryPort,
} from "../../domain/ports/transcript-repository.port.js";

/**
 * Purga diaria de grabaciones y transcripciones vencidas (RGPD).
 *
 * Un dato que debía borrarse y sigue ahí es un incumplimiento, no un
 * descuido: `schools.data_retention_days` calcula, al crear cada
 * transcripción, hasta cuándo se conserva (`transcripts.retention_until`);
 * este trabajo es quien de verdad la borra cuando llega el día.
 *
 * **Con qué identidad corre.** Este trabajo lo dispara `@nestjs/schedule`,
 * no una petición HTTP: no hay sesión que verificar ni interceptor que fije
 * el tenant. Actúa como sistema, nunca como una persona —por eso nunca pasa
 * `actorMembershipId` al auditar—, y fija el tenant él mismo, escuela por
 * escuela: abre un contexto de CLS nuevo (`ClsService#run`) para cada una y
 * escribe `CLS_SCHOOL_ID` ahí dentro, exactamente lo que hace
 * `SessionTenantInterceptor` para una petición HTTP, solo que aquí no hay
 * petición que lo dispare. Sin ese contexto, `UnitOfWork.execute()` no
 * tendría school_id que fijar y RLS no dejaría ver ni borrar nada.
 *
 * Recorrer las escuelas de una en una —y no un único `DELETE` a través de
 * todas— es deliberado: cada iteración pasa por el mismo camino
 * (`UnitOfWork` + RLS) que cualquier otra escritura del sistema, así que un
 * error en este trabajo no puede filtrar datos entre escuelas aunque tenga
 * un bug.
 */
@Injectable()
export class PurgeExpiredRecordingsJob {
  constructor(
    private readonly cls: ClsService,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(SCHOOL_DIRECTORY) private readonly schools: SchoolDirectoryPort,
    @Inject(TRANSCRIPT_REPOSITORY) private readonly transcripts: TranscriptRepositoryPort,
    @Inject(RECORDING_STORAGE) private readonly storage: RecordingStoragePort,
    @Inject(AUDIT_LOG) private readonly auditLog: AuditLogPort,
    @Inject(CLOCK) private readonly clock: Clock,
    @InjectPinoLogger(PurgeExpiredRecordingsJob.name) private readonly logger: PinoLogger,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async run(): Promise<void> {
    const schoolIds = await this.schools.allIds();
    let purged = 0;
    for (const schoolId of schoolIds) {
      purged += await this.purgeSchool(schoolId);
    }
    this.logger.info(
      `Purga RGPD: ${purged} transcripción(es) vencida(s) eliminada(s) en ${schoolIds.length} escuela(s).`,
    );
  }

  private purgeSchool(schoolId: string): Promise<number> {
    // Contexto de CLS nuevo por escuela: aislado del de la escuela anterior,
    // igual que cada petición HTTP tiene el suyo.
    return this.cls.run(() => {
      this.cls.set(CLS_SCHOOL_ID, schoolId);
      return this.uow.execute(() => this.purgeExpiredTranscripts(schoolId));
    });
  }

  private async purgeExpiredTranscripts(schoolId: string): Promise<number> {
    const now = this.clock.now();
    const candidates = await this.transcripts.findExpired(now);
    let purged = 0;

    for (const candidate of candidates) {
      // Red de seguridad: el repositorio ya filtra por `retention_until`,
      // pero un borrado es irreversible y no se fía de una sola capa. Una
      // transcripción sin plazo (bloqueada por falta de consentimiento) o
      // con plazo futuro nunca llega a borrarse desde aquí.
      if (!candidate.retentionUntil || candidate.retentionUntil > now) continue;

      if (candidate.recordingStorageKey) {
        try {
          await this.storage.delete(candidate.recordingStorageKey);
        } catch (error) {
          this.logger.error(
            `No se pudo borrar el fichero de la transcripción ${candidate.id}: ${String(error)}. ` +
              "Se reintentará en la próxima ejecución.",
          );
          continue;
        }
      }

      await this.transcripts.delete(candidate.id);
      await this.auditLog.record({
        schoolId,
        actorKind: "system",
        action: "classroom.transcript.purged",
        entityType: "transcript",
        entityId: candidate.id,
      });
      purged++;
    }

    return purged;
  }
}
