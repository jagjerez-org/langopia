import type {
  TranscriptRecurringError,
  TranscriptSegment,
  TranscriptVocabulary,
} from "../model/transcript.aggregate.js";

export type TranscriptSummaryCost = {
  creditsCharged: number;
  costCents: number;
};

export type TranscriptSummaryResult = {
  summary: string;
  vocabulary: TranscriptVocabulary[];
  recurringErrors: TranscriptRecurringError[];
  cost: TranscriptSummaryCost;
};

export interface TranscriptSummarizerPort {
  summarizeClass(params: {
    transcriptId: string;
    sessionId: string;
    language: string;
    segments: readonly TranscriptSegment[];
  }): Promise<TranscriptSummaryResult>;
}

export const TRANSCRIPT_SUMMARIZER_PORT = Symbol("TranscriptSummarizerPort");
