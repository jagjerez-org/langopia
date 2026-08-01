import { describe, expect, it, vi } from "vitest";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import type { TenantContext } from "../../../../shared/domain/ports/tenant-context.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { MembershipId } from "../../../../shared/domain/primitives/school-id.js";
import type { TranscriptRepositoryPort } from "../../../domain/ports/transcript-repository.port.js";
import type { TranscriptionPort } from "../../../domain/ports/transcription.port.js";
import { StartTranscriptionCommand } from "./start-transcription.command.js";
import { StartTranscriptionHandler } from "./start-transcription.handler.js";

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const TRANSCRIPT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STUDENT_ID = "33333333-3333-4333-8333-333333333333";
const TEACHER_ID = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-07-28T10:00:00Z");

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeTenant(): TenantContext {
  return {
    schoolId: () => SCHOOL_ID,
    membershipId: () => TEACHER_ID,
    roles: () => ["teacher"],
    has: (role) => role === "teacher",
  };
}

function build(repo: TranscriptRepositoryPort, transcription: TranscriptionPort) {
  return new StartTranscriptionHandler(
    repo,
    transcription,
    fakeUow(),
    fakeTenant(),
    { now: () => NOW } as Clock,
    { generate: () => TRANSCRIPT_ID } as IdGenerator,
  );
}

describe("StartTranscriptionHandler", () => {
  it("bloquea y no arranca LiveKit si un participante no consintió", async () => {
    const save = vi.fn();
    const startLive = vi.fn();
    const handler = build(
      {
        findExpired: vi.fn(),
        findExternalCompletedWithoutTranscript: vi.fn(),
        delete: vi.fn(),
        recordingStatusForSession: vi.fn(),
        findReadyById: vi.fn(),
        save,
        consentReadinessForSession: vi.fn().mockResolvedValue({
          dataRetentionDays: 180,
          participants: [
            {
              membershipId: MembershipId.of(STUDENT_ID),
              displayName: "Hugo Peiró",
              isMinor: true,
              guardianMembershipId: MembershipId.of("55555555-5555-4555-8555-555555555555"),
              consentStatus: "denied",
              grantedByMembershipId: MembershipId.of("55555555-5555-4555-8555-555555555555"),
            },
          ],
        }),
        deleteForParticipant: vi.fn(),
      },
      { startLiveTranscription: startLive },
    );

    const result = await handler.execute(
      new StartTranscriptionCommand({ sessionId: SESSION_ID, language: "en" }),
    );

    expect(result).toEqual({ transcriptId: TRANSCRIPT_ID, status: "blocked_no_consent" });
    expect(startLive).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ status: "blocked_no_consent" }));
  });

  it("guarda y arranca LiveKit cuando todos consienten", async () => {
    const save = vi.fn();
    const startLive = vi.fn().mockResolvedValue({ providerRef: "lk-agent-1" });
    const handler = build(
      {
        findExpired: vi.fn(),
        findExternalCompletedWithoutTranscript: vi.fn(),
        delete: vi.fn(),
        recordingStatusForSession: vi.fn(),
        findReadyById: vi.fn(),
        save,
        consentReadinessForSession: vi.fn().mockResolvedValue({
          dataRetentionDays: 180,
          participants: [
            {
              membershipId: MembershipId.of(STUDENT_ID),
              displayName: "Lucía Rojas",
              isMinor: false,
              guardianMembershipId: null,
              consentStatus: "granted",
              grantedByMembershipId: MembershipId.of(STUDENT_ID),
            },
          ],
        }),
        deleteForParticipant: vi.fn(),
      },
      { startLiveTranscription: startLive },
    );

    const result = await handler.execute(
      new StartTranscriptionCommand({ sessionId: SESSION_ID, language: "es" }),
    );

    expect(result).toEqual({ transcriptId: TRANSCRIPT_ID, status: "processing" });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ status: "processing" }));
    expect(startLive).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      transcriptId: TRANSCRIPT_ID,
      language: "es",
      participantMembershipIds: [STUDENT_ID],
    });
  });
});
