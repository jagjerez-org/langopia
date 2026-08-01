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

const TEAMS_TOKEN_ENV = "MICROSOFT_TEAMS_TRANSCRIPT_ACCESS_TOKEN";
const TEAMS_API_URL_ENV = "MICROSOFT_TEAMS_TRANSCRIPT_API_URL";

type TeamsPayload = {
  language?: string;
  utterances?: Array<{
    startMs?: number;
    endMs?: number;
    text?: string;
    speaker?: { displayName?: string };
    confidence?: number;
  }>;
};

@Injectable()
export class TeamsTranscriptAdapter implements ExternalTranscriptImporterPort {
  async importTranscript(request: ImportExternalTranscriptRequest): Promise<ImportExternalTranscriptResult> {
    const token = process.env[TEAMS_TOKEN_ENV];
    const baseUrl = process.env[TEAMS_API_URL_ENV];
    if (!token || !baseUrl) {
      return unavailable("La escuela no tiene Microsoft Teams conectado por OAuth.", false);
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/meetings/${request.externalId}/transcript`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (response.status === 404) {
      return unavailable("Microsoft Teams todavía no ha generado la transcripción oficial.", true);
    }
    if (!response.ok) {
      return unavailable(`Microsoft Teams respondió ${response.status} al importar la transcripción.`, true);
    }

    const normalized = normalizeTeamsTranscript((await response.json()) as TeamsPayload);
    if (normalized.segments.length === 0) {
      return unavailable("Microsoft Teams devolvió una transcripción vacía.", false);
    }
    return { status: "imported", summary: null, ...normalized };
  }
}

export function normalizeTeamsTranscript(payload: TeamsPayload): NormalizedTranscript {
  const segments = (payload.utterances ?? []).flatMap((entry) => {
    const segment = cleanSegment({
      startMs: entry.startMs ?? 0,
      endMs: entry.endMs ?? 0,
      text: entry.text,
      speakerMembershipId: null,
      speakerLabel: entry.speaker?.displayName?.trim() || null,
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
