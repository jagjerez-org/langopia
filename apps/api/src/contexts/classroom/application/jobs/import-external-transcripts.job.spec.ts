import { AsyncLocalStorage } from "node:async_hooks";
import { ClsService } from "nestjs-cls";
import { describe, expect, it, vi } from "vitest";
import type { Clock } from "../../../shared/domain/ports/clock.port.js";
import type { IdGenerator } from "../../../shared/domain/ports/id-generator.port.js";
import type { UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { MembershipId } from "../../../shared/domain/primitives/school-id.js";
import type {
  ExternalTranscriptImportCandidate,
  TranscriptRepositoryPort,
} from "../../domain/ports/transcript-repository.port.js";
import type { ExternalTranscriptImporterPort } from "../../domain/ports/external-transcript-importer.port.js";
import type { SchoolDirectoryPort } from "../../domain/ports/school-directory.port.js";
import { ImportExternalTranscriptsJob } from "./import-external-transcripts.job.js";

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const TRANSCRIPT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STUDENT_ID = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-07-28T10:00:00Z");

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function candidate(overrides: Partial<ExternalTranscriptImportCandidate> = {}): ExternalTranscriptImportCandidate {
  return {
    sessionId: SESSION_ID,
    schoolId: SCHOOL_ID,
    provider: "zoom",
    externalId: "zoom-meeting-1",
    scheduledEnd: new Date("2026-07-28T07:30:00Z"),
    ...overrides,
  };
}

function buildJob(params: {
  candidates?: ExternalTranscriptImportCandidate[];
  importer: ExternalTranscriptImporterPort;
  consentStatus?: "granted" | "missing" | "denied" | "withdrawn";
}) {
  const saved: unknown[] = [];
  const cls = new ClsService(new AsyncLocalStorage());
  const schools: SchoolDirectoryPort = { allIds: async () => [SCHOOL_ID] };
  const transcripts: TranscriptRepositoryPort = {
    findExpired: vi.fn(),
    delete: vi.fn(),
    recordingStatusForSession: vi.fn(),
    findReadyById: vi.fn(),
    findExternalCompletedWithoutTranscript: vi.fn().mockResolvedValue(params.candidates ?? [candidate()]),
    consentReadinessForSession: vi.fn().mockResolvedValue({
      dataRetentionDays: 180,
      participants: [
        {
          membershipId: MembershipId.of(STUDENT_ID),
          displayName: "Lucía Rojas",
          isMinor: false,
          guardianMembershipId: null,
          consentStatus: params.consentStatus ?? "granted",
          grantedByMembershipId: MembershipId.of(STUDENT_ID),
        },
      ],
    }),
    save: async (transcript) => {
      saved.push(transcript);
    },
    deleteForParticipant: vi.fn(),
  };
  const job = new ImportExternalTranscriptsJob(
    cls,
    fakeUow(),
    schools,
    transcripts,
    params.importer,
    { now: () => NOW } as Clock,
    { generate: () => TRANSCRIPT_ID } as IdGenerator,
    { publish: vi.fn() },
    { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
  );
  return { job, saved, transcripts };
}

describe("ImportExternalTranscriptsJob", () => {
  it("importa segmentos oficiales cuando todos consienten", async () => {
    const importer: ExternalTranscriptImporterPort = {
      importTranscript: vi.fn().mockResolvedValue({
        status: "imported",
        language: "en",
        durationMs: 5000,
        summary: "Clase importada.",
        segments: [
          {
            startMs: 0,
            endMs: 5000,
            text: "Hello",
            speakerMembershipId: null,
            speakerLabel: "Carla",
            confidenceBps: 9300,
            isTeacher: true,
          },
        ],
      }),
    };
    const { job, saved } = buildJob({ importer });

    await job.run();

    expect(saved).toHaveLength(1);
    expect(saved[0]).toEqual(
      expect.objectContaining({
        id: expect.objectContaining({ value: TRANSCRIPT_ID }),
        status: "ready",
        provider: "zoom",
        segments: [expect.objectContaining({ text: "Hello", speakerLabel: "Carla" })],
      }),
    );
  });

  it("bloquea sin importar segmentos si falta consentimiento", async () => {
    const importer: ExternalTranscriptImporterPort = { importTranscript: vi.fn() };
    const { job, saved } = buildJob({ importer, consentStatus: "missing" });

    await job.run();

    expect(importer.importTranscript).not.toHaveBeenCalled();
    expect(saved[0]).toEqual(
      expect.objectContaining({
        status: "blocked_no_consent",
        segments: [],
      }),
    );
  });

  it("marca failed si falta OAuth para no reintentar indefinidamente", async () => {
    const importer: ExternalTranscriptImporterPort = {
      importTranscript: vi.fn().mockResolvedValue({
        status: "unavailable",
        reason: "La escuela no tiene Zoom conectado por OAuth.",
        retryable: false,
      }),
    };
    const { job, saved } = buildJob({ importer });

    await job.run();

    expect(saved[0]).toEqual(
      expect.objectContaining({
        status: "failed",
        blockedReason: "La escuela no tiene Zoom conectado por OAuth.",
      }),
    );
  });
});
