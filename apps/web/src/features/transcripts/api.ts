import { api } from "../../lib/api-client.js";

export type TranscriptStatus = "pending" | "recording" | "processing" | "ready" | "blocked_no_consent" | "failed";

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
  status: TranscriptStatus;
  provider: string;
  language: string;
  durationMs: number | null;
  summary: string | null;
  blockedReason: string | null;
  readyAt: string | null;
  segments: TranscriptSegmentView[];
};

export function listTranscripts(): Promise<TranscriptView[]> {
  return api.get<TranscriptView[]>("/classroom/transcripts");
}
