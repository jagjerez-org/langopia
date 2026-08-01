import type { TranscriptSegment } from "../../domain/model/transcript.aggregate.js";

export type NormalizedTranscript = {
  language: string;
  durationMs: number;
  segments: TranscriptSegment[];
};

export function toConfidenceBps(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value <= 1) return Math.round(Math.max(0, Math.min(1, value)) * 10_000);
  return Math.round(Math.max(0, Math.min(10_000, value)));
}

export function durationFromSegments(segments: TranscriptSegment[]): number {
  return segments.reduce((max, segment) => Math.max(max, segment.endMs), 0);
}

export function cleanSegment(segment: Omit<TranscriptSegment, "text"> & { text: unknown }): TranscriptSegment | null {
  if (typeof segment.text !== "string") return null;
  const text = segment.text.trim();
  if (!text || segment.endMs <= segment.startMs) return null;
  return { ...segment, text };
}

export function unavailable(reason: string, retryable: boolean) {
  return { status: "unavailable" as const, reason, retryable };
}
