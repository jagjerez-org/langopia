import { Inject, Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ClsService } from "nestjs-cls";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { CLOCK, type Clock } from "../../../shared/domain/ports/clock.port.js";
import { EVENT_PUBLISHER, type EventPublisher } from "../../../shared/domain/ports/event-publisher.port.js";
import { ID_GENERATOR, type IdGenerator } from "../../../shared/domain/ports/id-generator.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { CLS_SCHOOL_ID } from "../../../shared/infrastructure/tenant/cls-tenant-context.js";
import {
  Transcript,
  TranscriptId,
  type TranscriptConsentParticipant,
} from "../../domain/model/transcript.aggregate.js";
import {
  EXTERNAL_TRANSCRIPT_IMPORTER,
  type ExternalTranscriptImporterPort,
  type ImportExternalTranscriptResult,
} from "../../domain/ports/external-transcript-importer.port.js";
import { SCHOOL_DIRECTORY, type SchoolDirectoryPort } from "../../domain/ports/school-directory.port.js";
import {
  TRANSCRIPT_REPOSITORY,
  type ExternalTranscriptImportCandidate,
  type TranscriptRepositoryPort,
} from "../../domain/ports/transcript-repository.port.js";

const MAX_IMPORT_ATTEMPTS = 3;

@Injectable()
export class ImportExternalTranscriptsJob {
  constructor(
    private readonly cls: ClsService,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(SCHOOL_DIRECTORY) private readonly schools: SchoolDirectoryPort,
    @Inject(TRANSCRIPT_REPOSITORY) private readonly transcripts: TranscriptRepositoryPort,
    @Inject(EXTERNAL_TRANSCRIPT_IMPORTER) private readonly importer: ExternalTranscriptImporterPort,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @InjectPinoLogger(ImportExternalTranscriptsJob.name) private readonly logger: PinoLogger,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    const schoolIds = await this.schools.allIds();
    let imported = 0;
    let closed = 0;

    for (const schoolId of schoolIds) {
      const result = await this.importSchool(schoolId);
      imported += result.imported;
      closed += result.closed;
    }

    this.logger.info(
      `Importación de transcripciones externas: ${imported} importada(s), ${closed} cerrada(s) en ${schoolIds.length} escuela(s).`,
    );
  }

  private importSchool(schoolId: string): Promise<{ imported: number; closed: number }> {
    return this.cls.run(async () => {
      this.cls.set(CLS_SCHOOL_ID, schoolId);
      const candidates = await this.uow.read(() =>
        this.transcripts.findExternalCompletedWithoutTranscript(this.clock.now()),
      );
      let imported = 0;
      let closed = 0;
      for (const candidate of candidates) {
        const result = await this.importCandidate(candidate);
        if (result === "imported") imported++;
        if (result === "closed") closed++;
      }
      return { imported, closed };
    });
  }

  private async importCandidate(candidate: ExternalTranscriptImportCandidate): Promise<"imported" | "closed" | "skipped"> {
    const precheck = await this.uow.read(() => this.transcripts.consentReadinessForSession(candidate.sessionId));
    const firstTranscript = this.startTranscript(candidate, precheck.participants);

    if (firstTranscript.status === "blocked_no_consent") {
      await this.uow.execute(() => this.transcripts.save(firstTranscript));
      return "closed";
    }

    const imported = await this.importWithBoundedRetries(candidate);

    const events = await this.uow.execute(async () => {
      const readiness = await this.transcripts.consentReadinessForSession(candidate.sessionId);
      const transcript = this.startTranscript(
        candidate,
        readiness.participants,
        imported.status === "imported" ? imported.language : "und",
      );
      if (transcript.status === "blocked_no_consent") {
        await this.transcripts.save(transcript);
        return [];
      }

      if (imported.status === "unavailable") {
        transcript.fail(imported.reason);
        await this.transcripts.save(transcript);
        return [];
      }

      for (const segment of imported.segments) {
        transcript.appendSegment({
          ...segment,
          speakerMembershipId: segment.speakerMembershipId,
        });
      }
      transcript.complete({
        durationMs: imported.durationMs,
        summary: imported.summary,
        vocabulary: [],
        recordingStorageKey: null,
        dataRetentionDays: readiness.dataRetentionDays,
        now: this.clock.now(),
      });
      await this.transcripts.save(transcript);
      return transcript.pullDomainEvents();
    });
    await this.events.publish(events);

    return imported.status === "imported" ? "imported" : "closed";
  }

  private startTranscript(
    candidate: ExternalTranscriptImportCandidate,
    participants: TranscriptConsentParticipant[],
    language = "und",
  ): Transcript {
    return Transcript.start({
      id: TranscriptId.of(this.ids.generate()),
      schoolId: SchoolId.of(candidate.schoolId),
      sessionId: candidate.sessionId,
      provider: candidate.provider,
      language,
      participants,
      now: this.clock.now(),
    });
  }

  private async importWithBoundedRetries(
    candidate: ExternalTranscriptImportCandidate,
  ): Promise<ImportExternalTranscriptResult> {
    let last: ImportExternalTranscriptResult | null = null;
    for (let attempt = 1; attempt <= MAX_IMPORT_ATTEMPTS; attempt++) {
      try {
        last = await this.importer.importTranscript(candidate);
      } catch (error) {
        last = {
          status: "unavailable",
          reason: `No se pudo importar la transcripción externa: ${String(error)}`,
          retryable: true,
        };
      }
      if (last.status === "imported" || !last.retryable) return last;
    }
    this.logger.warn(
      `Transcripción externa ${candidate.provider}/${candidate.externalId} agotó ${MAX_IMPORT_ATTEMPTS} intento(s).`,
    );
    return last ?? {
      status: "unavailable",
      reason: "No se pudo importar la transcripción externa.",
      retryable: false,
    };
  }
}
