import { DomainEvent } from "../../../shared/domain/events/domain-event.js";
import type { TranscriptVocabulary } from "../model/transcript.aggregate.js";

export class TranscriptReady extends DomainEvent {
  readonly eventName = "classroom.transcript.ready";

  constructor(
    private readonly data: {
      transcriptId: string;
      schoolId: string;
      sessionId: string;
      language: string;
      participantMembershipIds: readonly string[];
    },
  ) {
    super({ aggregateId: data.transcriptId, schoolId: data.schoolId });
  }

  payload() {
    return {
      transcriptId: this.data.transcriptId,
      sessionId: this.data.sessionId,
      language: this.data.language,
      participantMembershipIds: [...this.data.participantMembershipIds],
    };
  }
}

export class ClassVocabularyExtracted extends DomainEvent {
  readonly eventName = "classroom.vocabulary.extracted";

  constructor(
    private readonly data: {
      transcriptId: string;
      schoolId: string;
      sessionId: string;
      language: string;
      participantMembershipIds: readonly string[];
      vocabulary: readonly TranscriptVocabulary[];
    },
  ) {
    super({ aggregateId: data.transcriptId, schoolId: data.schoolId });
  }

  payload() {
    return {
      transcriptId: this.data.transcriptId,
      sessionId: this.data.sessionId,
      language: this.data.language,
      participantMembershipIds: [...this.data.participantMembershipIds],
      vocabulary: this.data.vocabulary.map((item) => ({ ...item })),
    };
  }
}
