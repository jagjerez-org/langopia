import { Inject } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { ClassVocabularyExtracted } from "../../../classroom/domain/events/transcript.events.js";
import { CLOCK, type Clock } from "../../../shared/domain/ports/clock.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import {
  SCHOOL_CALENDAR_PORT,
  type SchoolCalendarPort,
} from "../../domain/ports/school-calendar.port.js";
import {
  SRS_CARD_REPOSITORY,
  type SrsCardRepository,
} from "../../domain/ports/srs-card.repository.port.js";

@EventsHandler(ClassVocabularyExtracted)
export class OnClassVocabularyExtracted implements IEventHandler<ClassVocabularyExtracted> {
  constructor(
    @Inject(SRS_CARD_REPOSITORY) private readonly cards: SrsCardRepository,
    @Inject(SCHOOL_CALENDAR_PORT) private readonly calendar: SchoolCalendarPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async handle(event: ClassVocabularyExtracted): Promise<void> {
    const data = event.payload() as {
      transcriptId: string;
      participantMembershipIds: string[];
      vocabulary: Array<{ term: string; lemma?: string; level?: string; count: number }>;
    };
    if (data.vocabulary.length === 0 || data.participantMembershipIds.length === 0) return;

    const now = this.clock.now();
    await this.uow.execute(async () => {
      const today = await this.calendar.today(now);
      await this.cards.createVocabularyCardsForParticipants({
        schoolId: event.schoolId,
        transcriptId: data.transcriptId,
        participantMembershipIds: data.participantMembershipIds,
        vocabulary: data.vocabulary,
        dueOn: today,
        now,
      });
    });
  }
}
