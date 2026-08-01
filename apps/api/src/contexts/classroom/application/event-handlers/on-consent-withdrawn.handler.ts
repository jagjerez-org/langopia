import { Inject } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { ConsentWithdrawn } from "../../../people/domain/events/student.events.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import {
  TRANSCRIPT_REPOSITORY,
  type TranscriptRepositoryPort,
} from "../../domain/ports/transcript-repository.port.js";

@EventsHandler(ConsentWithdrawn)
export class OnConsentWithdrawnDeleteTranscripts implements IEventHandler<ConsentWithdrawn> {
  constructor(
    @Inject(TRANSCRIPT_REPOSITORY) private readonly transcripts: TranscriptRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @InjectPinoLogger(OnConsentWithdrawnDeleteTranscripts.name) private readonly logger: PinoLogger,
  ) {}

  async handle(event: ConsentWithdrawn): Promise<void> {
    const data = event.payload();
    if (data.kind !== "recording" && data.kind !== "transcription") return;
    const deleted = await this.uow.execute(() =>
      this.transcripts.deleteForParticipant(String(data.subjectMembershipId)),
    );
    this.logger.info(
      `Consentimiento ${data.kind} retirado por ${data.subjectMembershipId}: ${deleted} transcripción(es) borrada(s).`,
    );
  }
}
