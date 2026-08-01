import { Injectable } from "@nestjs/common";
import type {
  ExternalTranscriptImporterPort,
  ImportExternalTranscriptRequest,
  ImportExternalTranscriptResult,
} from "../../domain/ports/external-transcript-importer.port.js";
import { cleanSegment, durationFromSegments, unavailable } from "./transcript-normalization.js";

const ZOOM_TOKEN_ENV = "ZOOM_TRANSCRIPT_ACCESS_TOKEN";
const ZOOM_API_URL_ENV = "ZOOM_TRANSCRIPT_API_URL";

@Injectable()
export class ZoomTranscriptAdapter implements ExternalTranscriptImporterPort {
  async importTranscript(request: ImportExternalTranscriptRequest): Promise<ImportExternalTranscriptResult> {
    const token = process.env[ZOOM_TOKEN_ENV];
    const baseUrl = process.env[ZOOM_API_URL_ENV];
    if (!token || !baseUrl) {
      return unavailable("La escuela no tiene Zoom conectado por OAuth.", false);
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/meetings/${request.externalId}/transcript`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "text/vtt" },
    });

    if (response.status === 404) {
      return unavailable("Zoom todavía no ha generado la transcripción oficial.", true);
    }
    if (!response.ok) {
      return unavailable(`Zoom respondió ${response.status} al importar la transcripción.`, true);
    }

    const segments = parseZoomVtt(await response.text());
    if (segments.length === 0) return unavailable("Zoom devolvió una transcripción vacía.", false);
    return {
      status: "imported",
      language: "und",
      durationMs: durationFromSegments(segments),
      summary: null,
      segments,
    };
  }
}

export function parseZoomVtt(vtt: string) {
  const blocks = vtt
    .replace(/\r/g, "")
    .split("\n\n")
    .map((block) => block.trim())
    .filter((block) => block && block !== "WEBVTT");

  return blocks.flatMap((block) => {
    const lines = block.split("\n").filter(Boolean);
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex < 0) return [];
    const [startRaw, endRaw] = lines[timingIndex]!.split("-->").map((part) => part.trim());
    if (!startRaw || !endRaw) return [];
    const startMs = parseTimestamp(startRaw);
    const endMs = parseTimestamp(endRaw);
    if (startMs === null || endMs === null) return [];

    const textRaw = lines.slice(timingIndex + 1).join(" ").trim();
    const speakerMatch = /^([^:]{1,120}):\s*(.+)$/.exec(textRaw);
    const speakerLabel = speakerMatch?.[1]?.trim() || null;
    const text = speakerMatch?.[2] ?? textRaw;
    const segment = cleanSegment({
      startMs,
      endMs,
      text,
      speakerMembershipId: null,
      speakerLabel,
      confidenceBps: null,
      isTeacher: false,
    });
    return segment ? [segment] : [];
  });
}

function parseTimestamp(value: string): number | null {
  const [time] = value.split(/\s+/);
  if (!time) return null;
  const parts = time.split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  const secondsRaw = parts.at(-1);
  const minutesRaw = parts.at(-2);
  const hoursRaw = parts.length === 3 ? parts[0] : "0";
  if (!secondsRaw || !minutesRaw || !hoursRaw) return null;
  const seconds = Number(secondsRaw.replace(",", "."));
  const minutes = Number(minutesRaw);
  const hours = Number(hoursRaw);
  if (![seconds, minutes, hours].every(Number.isFinite)) return null;
  return Math.round(((hours * 60 + minutes) * 60 + seconds) * 1000);
}
