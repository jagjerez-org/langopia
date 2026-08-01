import { describe, expect, it } from "vitest";
import { TranscriptReady } from "../../domain/events/transcript.events.js";
import { Transcript, TranscriptId } from "../../domain/model/transcript.aggregate.js";
import type { CreditLedgerPort } from "../../domain/ports/credit-ledger.port.js";
import type { TranscriptRepositoryPort } from "../../domain/ports/transcript-repository.port.js";
import type { TranscriptSummarizerPort } from "../../domain/ports/transcript-summarizer.port.js";
import type { EventPublisher } from "../../../shared/domain/ports/event-publisher.port.js";
import type { IdGenerator } from "../../../shared/domain/ports/id-generator.port.js";
import type { UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { OnTranscriptReady, TRANSCRIPT_SUMMARY_CREDIT_RESERVE } from "./on-transcript-ready.handler.js";

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const TRANSCRIPT_ID = "33333333-3333-4333-8333-333333333333";
const STUDENT_MEMBERSHIP = "44444444-4444-4444-8444-444444444444";
const GENERATION_ID = "55555555-5555-4555-8555-555555555555";

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeLogger() {
  return { info: () => undefined, warn: () => undefined, error: () => undefined };
}

function readyTranscript(): Transcript {
  const transcript = Transcript.start({
    id: TranscriptId.of(TRANSCRIPT_ID),
    schoolId: SchoolId.of(SCHOOL_ID),
    sessionId: SESSION_ID,
    provider: "livekit",
    language: "en",
    participants: [
      {
        membershipId: MembershipId.of(STUDENT_MEMBERSHIP),
        displayName: "Lucía",
        isMinor: false,
        guardianMembershipId: null,
        consentStatus: "granted",
      },
    ],
    now: new Date("2026-07-28T10:00:00Z"),
  });
  transcript.appendSegment({
    startMs: 0,
    endMs: 5000,
    text: "I have twenty years and I need improve phrasal verbs.",
    speakerMembershipId: MembershipId.of(STUDENT_MEMBERSHIP),
    speakerLabel: "Lucía",
  });
  transcript.complete({
    durationMs: 5000,
    summary: null,
    vocabulary: [],
    recordingStorageKey: null,
    dataRetentionDays: 180,
    now: new Date("2026-07-28T10:05:00Z"),
  });
  transcript.pullDomainEvents();
  return transcript;
}

function transcriptReadyEvent(): TranscriptReady {
  return new TranscriptReady({
    transcriptId: TRANSCRIPT_ID,
    schoolId: SCHOOL_ID,
    sessionId: SESSION_ID,
    language: "en",
    participantMembershipIds: [STUDENT_MEMBERSHIP],
  });
}

describe("OnTranscriptReady", () => {
  it("reserva créditos, resume, guarda vocabulario y publica ClassVocabularyExtracted", async () => {
    const saved: Transcript[] = [];
    const movements: Array<{ kind: "spend" | "refund"; credits: number }> = [];
    const published: string[] = [];
    const transcript = readyTranscript();

    const repo: TranscriptRepositoryPort = {
      findReadyById: async () => transcript,
      save: async (item: Transcript) => {
        saved.push(item);
      },
    } as unknown as TranscriptRepositoryPort;
    const credits: CreditLedgerPort = {
      spend: async ({ credits }) => {
        movements.push({ kind: "spend", credits });
      },
      refund: async ({ credits }) => {
        movements.push({ kind: "refund", credits });
      },
    };
    const summarizer: TranscriptSummarizerPort = {
      summarizeClass: async () => ({
        summary: "La clase trabajó presentación personal y phrasal verbs con bastante participación.",
        vocabulary: [{ term: "look up", lemma: "look up", level: "B1", count: 2 }],
        recurringErrors: [{ pattern: "I have 20 years", suggestion: "Practicar I am 20 years old.", count: 2 }],
        cost: { creditsCharged: 2, costCents: 18 },
      }),
    };
    const events: EventPublisher = {
      publish: async (items) => {
        published.push(...items.map((event) => event.eventName));
      },
    };
    const ids: IdGenerator = { generate: () => GENERATION_ID };
    const handler = new OnTranscriptReady(
      repo,
      summarizer,
      credits,
      fakeUow(),
      events,
      ids,
      fakeLogger() as never,
    );

    await handler.handle(transcriptReadyEvent());

    expect(movements).toEqual([
      { kind: "spend", credits: TRANSCRIPT_SUMMARY_CREDIT_RESERVE },
      { kind: "refund", credits: 2 },
    ]);
    expect(saved).toHaveLength(1);
    expect(saved[0]!.summary).toContain("Errores recurrentes");
    expect(saved[0]!.vocabulary).toEqual([{ term: "look up", lemma: "look up", level: "B1", count: 2 }]);
    expect(published).toEqual(["classroom.vocabulary.extracted"]);
  });

  it("cobra la diferencia si el resumen consume más créditos que la reserva", async () => {
    const movements: Array<{ kind: "spend" | "refund"; credits: number; costCents?: number }> = [];
    const transcript = readyTranscript();

    const repo: TranscriptRepositoryPort = {
      findReadyById: async () => transcript,
      save: async () => undefined,
    } as unknown as TranscriptRepositoryPort;
    const credits: CreditLedgerPort = {
      spend: async ({ credits, costCents }) => {
        movements.push({ kind: "spend", credits, costCents });
      },
      refund: async ({ credits }) => {
        movements.push({ kind: "refund", credits });
      },
    };
    const summarizer: TranscriptSummarizerPort = {
      summarizeClass: async () => ({
        summary: "La clase fue más larga de lo esperado.",
        vocabulary: [],
        recurringErrors: [],
        cost: { creditsCharged: TRANSCRIPT_SUMMARY_CREDIT_RESERVE + 3, costCents: 71 },
      }),
    };
    const handler = new OnTranscriptReady(
      repo,
      summarizer,
      credits,
      fakeUow(),
      { publish: async () => undefined },
      { generate: () => GENERATION_ID },
      fakeLogger() as never,
    );

    await handler.handle(transcriptReadyEvent());

    expect(movements).toEqual([
      { kind: "spend", credits: TRANSCRIPT_SUMMARY_CREDIT_RESERVE, costCents: undefined },
      { kind: "spend", credits: 3, costCents: 71 },
    ]);
  });

  it("devuelve la reserva si falta el proveedor de resumen", async () => {
    const movements: Array<{ kind: "spend" | "refund"; credits: number }> = [];
    const transcript = readyTranscript();
    const repo: TranscriptRepositoryPort = {
      findReadyById: async () => transcript,
      save: async () => undefined,
    } as unknown as TranscriptRepositoryPort;
    const credits: CreditLedgerPort = {
      spend: async ({ credits }) => {
        movements.push({ kind: "spend", credits });
      },
      refund: async ({ credits }) => {
        movements.push({ kind: "refund", credits });
      },
    };
    const summarizer: TranscriptSummarizerPort = {
      summarizeClass: async () => {
        throw new Error("sin credenciales");
      },
    };
    const handler = new OnTranscriptReady(
      repo,
      summarizer,
      credits,
      fakeUow(),
      { publish: async () => undefined },
      { generate: () => GENERATION_ID },
      fakeLogger() as never,
    );

    await handler.handle(transcriptReadyEvent());

    expect(movements).toEqual([
      { kind: "spend", credits: TRANSCRIPT_SUMMARY_CREDIT_RESERVE },
      { kind: "refund", credits: TRANSCRIPT_SUMMARY_CREDIT_RESERVE },
    ]);
  });
});
