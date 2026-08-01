export type TranscriptSegmentView = {
  segmentId: string;
  startMs: number;
  endMs: number;
  speakerLabel: string | null;
  text: string;
  isTeacher: boolean;
};

export type TranscriptView = {
  transcriptId: string;
  sessionId: string;
  title: string;
  startsAt: string;
  status: "pending" | "recording" | "processing" | "ready" | "blocked_no_consent" | "failed";
  provider: string;
  language: string;
  durationMs: number | null;
  summary: string | null;
  blockedReason: string | null;
  readyAt: string | null;
  segments: TranscriptSegmentView[];
};

export interface TranscriptReadModel {
  listRecent(): Promise<TranscriptView[]>;
}

export const TRANSCRIPT_READ_MODEL = Symbol("TranscriptReadModel");
