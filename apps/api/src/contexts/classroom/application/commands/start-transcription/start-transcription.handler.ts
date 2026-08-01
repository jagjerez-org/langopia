import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import { ID_GENERATOR, type IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import { Transcript, TranscriptId } from "../../../domain/model/transcript.aggregate.js";
import {
  TRANSCRIPT_REPOSITORY,
  type TranscriptRepositoryPort,
} from "../../../domain/ports/transcript-repository.port.js";
import {
  TRANSCRIPTION_PORT,
  type TranscriptionPort,
} from "../../../domain/ports/transcription.port.js";
import { StartTranscriptionCommand } from "./start-transcription.command.js";

@CommandHandler(StartTranscriptionCommand)
export class StartTranscriptionHandler implements ICommandHandler<StartTranscriptionCommand> {
  constructor(
    @Inject(TRANSCRIPT_REPOSITORY) private readonly transcripts: TranscriptRepositoryPort,
    @Inject(TRANSCRIPTION_PORT) private readonly transcription: TranscriptionPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: StartTranscriptionCommand): Promise<{ transcriptId: string; status: string }> {
    const schoolId = this.tenant.schoolId();
    if (!schoolId) throw new Error("No se pudo determinar la escuela para iniciar la transcripción.");

    const transcript = await this.uow.execute(async () => {
      const readiness = await this.transcripts.consentReadinessForSession(command.props.sessionId);
      const created = Transcript.start({
        id: TranscriptId.of(this.ids.generate()),
        schoolId: SchoolId.of(schoolId),
        sessionId: command.props.sessionId,
        provider: "livekit",
        language: command.props.language,
        participants: readiness.participants,
        now: this.clock.now(),
      });
      await this.transcripts.save(created);
      return created;
    });

    if (transcript.status !== "blocked_no_consent") {
      await this.transcription.startLiveTranscription({
        sessionId: transcript.sessionId,
        transcriptId: transcript.id.value,
        language: transcript.language,
        participantMembershipIds: transcript.participantMembershipIds.map((id) => id.value),
      });
    }

    return { transcriptId: transcript.id.value, status: transcript.status };
  }
}
