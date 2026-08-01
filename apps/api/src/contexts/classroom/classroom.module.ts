import { Module } from "@nestjs/common";
import { OBJECT_STORAGE } from "../shared/domain/ports/object-storage.port.js";
import { JoinClassroomSessionHandler } from "./application/commands/join-session/join-session.handler.js";
import { StartTranscriptionHandler } from "./application/commands/start-transcription/start-transcription.handler.js";
import { ListTranscriptsHandler } from "./application/queries/list-transcripts/list-transcripts.handler.js";
import { OnConsentWithdrawnDeleteTranscripts } from "./application/event-handlers/on-consent-withdrawn.handler.js";
import { OnClassSessionScheduled } from "./application/event-handlers/on-class-session-scheduled.handler.js";
import { OnTranscriptReady } from "./application/event-handlers/on-transcript-ready.handler.js";
import { ImportExternalTranscriptsJob } from "./application/jobs/import-external-transcripts.job.js";
import { PurgeExpiredRecordingsJob } from "./application/jobs/purge-expired-recordings.job.js";
import { CREDIT_LEDGER_PORT } from "./domain/ports/credit-ledger.port.js";
import { EXTERNAL_TRANSCRIPT_IMPORTER } from "./domain/ports/external-transcript-importer.port.js";
import { RECORDING_STORAGE } from "./domain/ports/recording-storage.port.js";
import { ROOM_PROVIDER_PORT } from "./domain/ports/room-provider.port.js";
import { SCHOOL_DIRECTORY } from "./domain/ports/school-directory.port.js";
import { SESSION_PARTICIPATION_PORT } from "./domain/ports/session-participation.port.js";
import { SESSION_ROOM_PORT } from "./domain/ports/session-room.port.js";
import { TRANSCRIPT_REPOSITORY } from "./domain/ports/transcript-repository.port.js";
import { TRANSCRIPT_SUMMARIZER_PORT } from "./domain/ports/transcript-summarizer.port.js";
import { TRANSCRIPTION_PORT } from "./domain/ports/transcription.port.js";
import { TRANSCRIPT_READ_MODEL } from "./application/ports/transcript-read-model.port.js";
import { BillingCreditLedgerAdapter } from "./infrastructure/acl/billing-credit-ledger.adapter.js";
import { ClaudeTranscriptSummarizerAdapter } from "./infrastructure/external/claude-transcript-summarizer.adapter.js";
import { GoogleMeetRoomAdapter } from "./infrastructure/external/google-meet-room.adapter.js";
import { ExternalTranscriptImporterRegistry } from "./infrastructure/external/external-transcript-importer.registry.js";
import { LiveKitRoomAdapter } from "./infrastructure/external/livekit-room.adapter.js";
import { LiveKitTranscriptionAdapter } from "./infrastructure/external/livekit-transcription.adapter.js";
import { MeetTranscriptAdapter } from "./infrastructure/external/meet-transcript.adapter.js";
import { RoomProviderRegistry } from "./infrastructure/external/room-provider.registry.js";
import { TeamsRoomAdapter } from "./infrastructure/external/teams-room.adapter.js";
import { TeamsTranscriptAdapter } from "./infrastructure/external/teams-transcript.adapter.js";
import { ZoomRoomAdapter } from "./infrastructure/external/zoom-room.adapter.js";
import { ZoomTranscriptAdapter } from "./infrastructure/external/zoom-transcript.adapter.js";
import { ClassroomController } from "./infrastructure/http/classroom.controller.js";
import { ClassroomCronController } from "./infrastructure/http/cron.controller.js";
import { DrizzleSchoolDirectoryRepository } from "./infrastructure/persistence/drizzle-school-directory.repository.js";
import { DrizzleCreditLedgerRepository } from "./infrastructure/persistence/drizzle-credit-ledger.repository.js";
import { DrizzleSessionParticipationRepository } from "./infrastructure/persistence/drizzle-session-participation.repository.js";
import { DrizzleSessionRoomRepository } from "./infrastructure/persistence/drizzle-session-room.repository.js";
import { DrizzleTranscriptRepository } from "./infrastructure/persistence/drizzle-transcript-repository.js";
import { DrizzleTranscriptReadModel } from "./infrastructure/persistence/drizzle-transcript-read-model.js";

/**
 * Contexto acotado del aula: la sala donde ocurre la clase, sus grabaciones y
 * transcripciones. La purga de datos vencidos (RGPD, tarea 12 de la ola 0)
 * convive aquí con el aula propia y las integraciones de vídeo (tarea 6 de la
 * ola 1): un caso de uso a la vez, no una estructura completa por adelantado.
 *
 * `RECORDING_STORAGE` se ata a `OBJECT_STORAGE` (de `shared`, `@Global()`) en
 * vez de a un adaptador propio: es la misma necesidad (borrar un fichero por
 * clave) que ya resuelve el almacén de objetos compartido, y antes de la
 * tarea 4 de la ola 2 —cuando ese almacén no existía— este puerto resolvía
 * contra un noop que nunca tocaba nada real. Ver `object-storage.port.ts`.
 */
@Module({
  controllers: [ClassroomController, ClassroomCronController],
  providers: [
    ImportExternalTranscriptsJob,
    PurgeExpiredRecordingsJob,
    OnClassSessionScheduled,
    OnConsentWithdrawnDeleteTranscripts,
    OnTranscriptReady,
    JoinClassroomSessionHandler,
    StartTranscriptionHandler,
    ListTranscriptsHandler,
    DrizzleCreditLedgerRepository,
    ClaudeTranscriptSummarizerAdapter,
    LiveKitRoomAdapter,
    LiveKitTranscriptionAdapter,
    ExternalTranscriptImporterRegistry,
    ZoomTranscriptAdapter,
    MeetTranscriptAdapter,
    TeamsTranscriptAdapter,
    GoogleMeetRoomAdapter,
    ZoomRoomAdapter,
    TeamsRoomAdapter,
    { provide: TRANSCRIPT_REPOSITORY, useClass: DrizzleTranscriptRepository },
    { provide: TRANSCRIPT_READ_MODEL, useClass: DrizzleTranscriptReadModel },
    { provide: TRANSCRIPTION_PORT, useClass: LiveKitTranscriptionAdapter },
    { provide: TRANSCRIPT_SUMMARIZER_PORT, useClass: ClaudeTranscriptSummarizerAdapter },
    { provide: CREDIT_LEDGER_PORT, useClass: BillingCreditLedgerAdapter },
    { provide: EXTERNAL_TRANSCRIPT_IMPORTER, useClass: ExternalTranscriptImporterRegistry },
    { provide: SCHOOL_DIRECTORY, useClass: DrizzleSchoolDirectoryRepository },
    { provide: RECORDING_STORAGE, useExisting: OBJECT_STORAGE },
    { provide: SESSION_ROOM_PORT, useClass: DrizzleSessionRoomRepository },
    { provide: SESSION_PARTICIPATION_PORT, useClass: DrizzleSessionParticipationRepository },
    { provide: ROOM_PROVIDER_PORT, useClass: RoomProviderRegistry },
  ],
})
export class ClassroomModule {}
