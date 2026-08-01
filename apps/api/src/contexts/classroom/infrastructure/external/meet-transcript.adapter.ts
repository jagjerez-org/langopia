import { Injectable } from "@nestjs/common";
import type {
  ExternalTranscriptImporterPort,
  ImportExternalTranscriptRequest,
  ImportExternalTranscriptResult,
} from "../../domain/ports/external-transcript-importer.port.js";
import {
  cleanSegment,
  durationFromSegments,
  toConfidenceBps,
  unavailable,
  type NormalizedTranscript,
} from "./transcript-normalization.js";

const MEET_TOKEN_ENV = "GOOGLE_MEET_TRANSCRIPT_ACCESS_TOKEN";
const MEET_API_URL_ENV = "GOOGLE_MEET_TRANSCRIPT_API_URL";

type MeetPayload = {
  language?: string;
  segments?: Array<{
    startTimeMs?: number;
    endTimeMs?: number;
    text?: string;
    participantName?: string;
    confidence?: number;
  }>;
};

@Injectable()
export class MeetTranscriptAdapter implements ExternalTranscriptImporterPort {
  async importTranscript(request: ImportExternalTranscriptRequest): Promise<ImportExternalTranscriptResult> {
    const token = process.env[MEET_TOKEN_ENV];
    const baseUrl = process.env[MEET_API_URL_ENV];
    if (!token || !baseUrl) {
      return unavailable("La escuela no tiene Google Meet conectado por OAuth.", false);
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/meetings/${request.externalId}/transcript`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (response.status === 404) {
      return unavailable("Google Meet todavía no ha generado la transcripción oficial.", true);
    }
    if (!response.ok) {
      return unavailable(`Google Meet respondió ${response.status} al importar la transcripción.`, true);
    }

    const normalized = normalizeMeetTranscript((await response.json()) as MeetPayload);
    if (normalized.segments.length === 0) {
      return unavailable("Google Meet devolvió una transcripción vacía.", false);
    }
    return { status: "imported", summary: null, ...normalized };
  }
}

export function normalizeMeetTranscript(payload: MeetPayload): NormalizedTranscript {
  const segments = (payload.segments ?? []).flatMap((entry) => {
    const segment = cleanSegment({
      startMs: entry.startTimeMs ?? 0,
      endMs: entry.endTimeMs ?? 0,
      text: entry.text,
      speakerMembershipId: null,
      speakerLabel: entry.participantName?.trim() || null,
      confidenceBps: toConfidenceBps(entry.confidence),
      isTeacher: false,
    });
    return segment ? [segment] : [];
  });
  return {
    language: payload.language ?? "und",
    durationMs: durationFromSegments(segments),
    segments,
  };
}
