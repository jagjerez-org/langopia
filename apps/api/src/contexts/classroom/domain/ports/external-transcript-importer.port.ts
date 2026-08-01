import type { RoomProvider } from "../model/room-provider.js";
import type { TranscriptSegment } from "../model/transcript.aggregate.js";

export type ExternalTranscriptProvider = Extract<RoomProvider, "zoom" | "google_meet" | "ms_teams">;

export type ImportExternalTranscriptRequest = {
  schoolId: string;
  sessionId: string;
  provider: ExternalTranscriptProvider;
  externalId: string;
};

export type ImportedExternalTranscript = {
  status: "imported";
  language: string;
  durationMs: number;
  summary: string | null;
  segments: TranscriptSegment[];
};

export type UnavailableExternalTranscript = {
  status: "unavailable";
  reason: string;
  retryable: boolean;
};

export type ImportExternalTranscriptResult =
  | ImportedExternalTranscript
  | UnavailableExternalTranscript;

export interface ExternalTranscriptImporterPort {
  importTranscript(request: ImportExternalTranscriptRequest): Promise<ImportExternalTranscriptResult>;
}

export const EXTERNAL_TRANSCRIPT_IMPORTER = Symbol("ExternalTranscriptImporterPort");
