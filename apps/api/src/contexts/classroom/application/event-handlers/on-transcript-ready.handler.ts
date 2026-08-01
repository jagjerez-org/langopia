import { Inject } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { EVENT_PUBLISHER, type EventPublisher } from "../../../shared/domain/ports/event-publisher.port.js";
import { ID_GENERATOR, type IdGenerator } from "../../../shared/domain/ports/id-generator.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { ClassVocabularyExtracted, TranscriptReady } from "../../domain/events/transcript.events.js";
import { CREDIT_LEDGER_PORT, type CreditLedgerPort } from "../../domain/ports/credit-ledger.port.js";
import {
  TRANSCRIPT_REPOSITORY,
  type TranscriptRepositoryPort,
} from "../../domain/ports/transcript-repository.port.js";
import {
  TRANSCRIPT_SUMMARIZER_PORT,
  type TranscriptSummarizerPort,
  type TranscriptSummaryResult,
} from "../../domain/ports/transcript-summarizer.port.js";

export const TRANSCRIPT_SUMMARY_CREDIT_RESERVE = 4;

@EventsHandler(TranscriptReady)
export class OnTranscriptReady implements IEventHandler<TranscriptReady> {
  constructor(
    @Inject(TRANSCRIPT_REPOSITORY) private readonly transcripts: TranscriptRepositoryPort,
    @Inject(TRANSCRIPT_SUMMARIZER_PORT) private readonly summarizer: TranscriptSummarizerPort,
    @Inject(CREDIT_LEDGER_PORT) private readonly credits: CreditLedgerPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @InjectPinoLogger(OnTranscriptReady.name) private readonly logger: PinoLogger,
  ) {}

  async handle(event: TranscriptReady): Promise<void> {
    const data = event.payload() as {
      transcriptId: string;
      sessionId: string;
      language: string;
      participantMembershipIds: string[];
    };
    const aiGenerationId = this.ids.generate();

    await this.uow.execute(() =>
      this.credits.spend({
        credits: TRANSCRIPT_SUMMARY_CREDIT_RESERVE,
        note: `Reserva estimada para resumir la transcripción ${data.transcriptId}`,
        aiGenerationId,
      }),
    );

    let result: TranscriptSummaryResult;
    try {
      const transcript = await this.uow.read(() => this.transcripts.findReadyById(data.transcriptId));
      if (!transcript || transcript.segments.length === 0) {
        await this.refundReserve(data.transcriptId, aiGenerationId, "transcripción no disponible");
        return;
      }

      result = await this.summarizer.summarizeClass({
        transcriptId: transcript.id.value,
        sessionId: transcript.sessionId,
        language: transcript.language,
        segments: transcript.segments,
      });

      const events = await this.uow.execute(async () => {
        const current = await this.transcripts.findReadyById(data.transcriptId);
        if (!current) return [];
        current.enrichSummary({
          summary: result.summary,
          vocabulary: result.vocabulary,
          recurringErrors: result.recurringErrors,
        });
        await this.transcripts.save(current);
        return result.vocabulary.length > 0
          ? [
              new ClassVocabularyExtracted({
                transcriptId: current.id.value,
                schoolId: event.schoolId,
                sessionId: current.sessionId,
                language: current.language,
                participantMembershipIds: data.participantMembershipIds,
                vocabulary: result.vocabulary,
              }),
            ]
          : [];
      });

      await this.adjustCredits(data.transcriptId, aiGenerationId, result);
      await this.events.publish(events);
    } catch (error) {
      await this.refundReserve(data.transcriptId, aiGenerationId, "falló el resumen");
      this.logger.warn(
        { err: error instanceof Error ? error : new Error(String(error)) },
        `No se pudo resumir la transcripción ${data.transcriptId}.`,
      );
    }
  }

  private async adjustCredits(
    transcriptId: string,
    aiGenerationId: string,
    result: TranscriptSummaryResult,
  ): Promise<void> {
    const delta = result.cost.creditsCharged - TRANSCRIPT_SUMMARY_CREDIT_RESERVE;
    if (delta > 0) {
      await this.uow.execute(() =>
        this.credits.spend({
          credits: delta,
          costCents: result.cost.costCents,
          note: `Ajuste de créditos del resumen de la transcripción ${transcriptId}`,
          aiGenerationId,
        }),
      );
      return;
    }

    const refund = Math.abs(delta);
    if (refund > 0) {
      await this.uow.execute(() =>
        this.credits.refund({
          credits: refund,
          note: `Ajuste de créditos del resumen de la transcripción ${transcriptId}`,
          aiGenerationId,
        }),
      );
    }
  }

  private async refundReserve(transcriptId: string, aiGenerationId: string, reason: string): Promise<void> {
    await this.uow.execute(() =>
      this.credits.refund({
        credits: TRANSCRIPT_SUMMARY_CREDIT_RESERVE,
        note: `Devolución del resumen de la transcripción ${transcriptId}: ${reason}.`,
        aiGenerationId,
      }),
    );
  }
}
