import { describe, expect, it } from "vitest";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { Transcript, TranscriptId, type TranscriptConsentParticipant } from "./transcript.aggregate.js";

const TRANSCRIPT_ID = TranscriptId.of("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const SCHOOL_ID = SchoolId.of("11111111-1111-4111-8111-111111111111");
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const ADULT = MembershipId.of("33333333-3333-4333-8333-333333333333");
const MINOR = MembershipId.of("44444444-4444-4444-8444-444444444444");
const GUARDIAN = MembershipId.of("55555555-5555-4555-8555-555555555555");
const TEACHER = MembershipId.of("66666666-6666-4666-8666-666666666666");
const NOW = new Date("2026-07-28T10:00:00Z");

function participant(
  overrides: Partial<TranscriptConsentParticipant> = {},
): TranscriptConsentParticipant {
  return {
    membershipId: ADULT,
    displayName: "Lucía Rojas",
    isMinor: false,
    guardianMembershipId: null,
    consentStatus: "granted",
    ...overrides,
  };
}

function startWith(participants: TranscriptConsentParticipant[]) {
  return Transcript.start({
    id: TRANSCRIPT_ID,
    schoolId: SCHOOL_ID,
    sessionId: SESSION_ID,
    provider: "livekit",
    language: "es",
    participants,
    now: NOW,
  });
}

describe("Transcript", () => {
  it("arranca cuando todos los participantes tienen consentimiento de grabación y transcripción", () => {
    const transcript = startWith([participant(), participant({ membershipId: TEACHER })]);

    expect(transcript.status).toBe("processing");
    expect(transcript.blockedReason).toBeNull();
  });

  it("nace bloqueado si falta el consentimiento de un participante y no admite segmentos", () => {
    const transcript = startWith([participant({ consentStatus: "missing" })]);

    expect(transcript.status).toBe("blocked_no_consent");
    expect(transcript.blockedReason).toContain("Lucía Rojas");
    expect(transcript.recordingStorageKey).toBeNull();

    expect(() =>
      transcript.appendSegment({
        startMs: 0,
        endMs: 1200,
        text: "Hola",
        speakerMembershipId: ADULT,
        confidenceBps: 9500,
      }),
    ).toThrow(/bloqueada/);
  });

  it("acepta a un menor cuando su tutor legal consintió", () => {
    const transcript = startWith([
      participant({
        membershipId: MINOR,
        displayName: "Adrián Peiró",
        isMinor: true,
        guardianMembershipId: GUARDIAN,
        consentStatus: "granted",
        grantedByMembershipId: GUARDIAN,
      }),
    ]);

    expect(transcript.status).toBe("processing");
  });

  it("bloquea a un menor cuyo tutor denegó el consentimiento", () => {
    const transcript = startWith([
      participant({
        membershipId: MINOR,
        displayName: "Hugo Peiró",
        isMinor: true,
        guardianMembershipId: GUARDIAN,
        consentStatus: "denied",
        grantedByMembershipId: GUARDIAN,
      }),
    ]);

    expect(transcript.status).toBe("blocked_no_consent");
    expect(transcript.blockedReason).toBe(
      "El tutor legal de Hugo Peiró no ha autorizado la grabación. No se generó ni audio ni transcripción.",
    );
  });

  it("bloquea a un menor si el consentimiento no lo firmó su tutor válido", () => {
    const transcript = startWith([
      participant({
        membershipId: MINOR,
        displayName: "Hugo Peiró",
        isMinor: true,
        guardianMembershipId: GUARDIAN,
        consentStatus: "granted",
        grantedByMembershipId: MINOR,
      }),
    ]);

    expect(transcript.status).toBe("blocked_no_consent");
    expect(transcript.blockedReason).toContain("tutor legal de Hugo Peiró");
  });

  it("al retirar consentimiento existente queda pendiente de borrado irreversible", () => {
    const transcript = startWith([participant()]);
    transcript.appendSegment({
      startMs: 0,
      endMs: 1600,
      text: "Vamos a empezar.",
      speakerMembershipId: ADULT,
      confidenceBps: 9100,
    });
    transcript.complete({
      durationMs: 1600,
      summary: "Inicio de clase.",
      vocabulary: [],
      recordingStorageKey: "recordings/session.webm",
      dataRetentionDays: 30,
      now: NOW,
    });

    expect(transcript.mustBeDeletedAfterConsentWithdrawal(ADULT)).toBe(true);
  });

  it("calcula retentionUntil al completar según los días de conservación de la escuela", () => {
    const transcript = startWith([participant()]);

    transcript.complete({
      durationMs: 42_000,
      summary: "Resumen",
      vocabulary: [{ term: "hola", count: 2 }],
      recordingStorageKey: "recordings/session.webm",
      dataRetentionDays: 45,
      now: NOW,
    });

    expect(transcript.status).toBe("ready");
    expect(transcript.retentionUntil?.toISOString()).toBe("2026-09-11T10:00:00.000Z");
  });

  it("guarda el hablante identificado o una etiqueta genérica si no se pudo identificar", () => {
    const transcript = startWith([participant()]);

    transcript.appendSegment({
      startMs: 0,
      endMs: 1000,
      text: "Hola",
      speakerMembershipId: ADULT,
      confidenceBps: 9900,
    });
    transcript.appendSegment({
      startMs: 1000,
      endMs: 2100,
      text: "¿Qué tal?",
      speakerMembershipId: null,
      confidenceBps: 8700,
    });

    expect(transcript.segments).toEqual([
      expect.objectContaining({ speakerMembershipId: ADULT, speakerLabel: null }),
      expect.objectContaining({ speakerMembershipId: null, speakerLabel: "Participante sin identificar" }),
    ]);
  });
});
