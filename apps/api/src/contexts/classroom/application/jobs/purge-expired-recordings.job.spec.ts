import { AsyncLocalStorage } from "node:async_hooks";
import { ClsService } from "nestjs-cls";
import { describe, expect, it } from "vitest";
import type { AuditLogEntry, AuditLogPort } from "../../../shared/domain/ports/audit-log.port.js";
import type { Clock } from "../../../shared/domain/ports/clock.port.js";
import type { UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import type { RecordingStoragePort } from "../../domain/ports/recording-storage.port.js";
import type { SchoolDirectoryPort } from "../../domain/ports/school-directory.port.js";
import type {
  PurgeCandidate,
  TranscriptRepositoryPort,
} from "../../domain/ports/transcript-repository.port.js";
import { PurgeExpiredRecordingsJob } from "./purge-expired-recordings.job.js";

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-07-27T03:00:00Z");
const PAST = new Date("2026-07-01T00:00:00Z");
const FUTURE = new Date("2027-01-01T00:00:00Z");

/**
 * Unidad de trabajo de prueba: ejecuta el trabajo directamente, sin
 * transacción real. Lo que se comprueba aquí es la orquestación del trabajo,
 * no Postgres — eso lo cubre la verificación contra el seed (paso 4).
 */
function fakeUnitOfWork(): UnitOfWork {
  return {
    execute: (work) => work(),
    read: (work) => work(),
  };
}

function buildJob(candidates: PurgeCandidate[]) {
  const deletedTranscripts: string[] = [];
  const deletedStorageKeys: string[] = [];
  const auditEntries: AuditLogEntry[] = [];

  const cls = new ClsService(new AsyncLocalStorage());

  const schools: SchoolDirectoryPort = {
    allIds: async () => [SCHOOL_ID],
  };

  const transcripts: TranscriptRepositoryPort = {
    findExpired: async () => candidates,
    findExternalCompletedWithoutTranscript: async () => [],
    delete: async (id) => {
      deletedTranscripts.push(id);
    },
    recordingStatusForSession: async () => null,
    findReadyById: async () => null,
    consentReadinessForSession: async () => ({ dataRetentionDays: 90, participants: [] }),
    save: async () => undefined,
    deleteForParticipant: async () => 0,
  };

  const storage: RecordingStoragePort = {
    delete: async (key) => {
      deletedStorageKeys.push(key);
    },
  };

  const auditLog: AuditLogPort = {
    record: async (entry) => {
      auditEntries.push(entry);
    },
  };

  const clock: Clock = { now: () => NOW };

  // De mentira, sin pasar por `nestjs-pino`: lo que se comprueba aquí es la
  // orquestación del trabajo, no el formato de sus líneas de registro.
  const logger = { info: () => undefined, warn: () => undefined, error: () => undefined };

  const job = new PurgeExpiredRecordingsJob(
    cls,
    fakeUnitOfWork(),
    schools,
    transcripts,
    storage,
    auditLog,
    clock,
    logger as never,
  );

  return { job, deletedTranscripts, deletedStorageKeys, auditEntries };
}

describe("PurgeExpiredRecordingsJob", () => {
  it("borra una transcripción con retention_until en el pasado", async () => {
    const { job, deletedTranscripts } = buildJob([
      { id: "t-vencida", retentionUntil: PAST, recordingStorageKey: null },
    ]);

    await job.run();

    expect(deletedTranscripts).toEqual(["t-vencida"]);
  });

  it("conserva una transcripción con retention_until futuro", async () => {
    const { job, deletedTranscripts } = buildJob([
      { id: "t-futura", retentionUntil: FUTURE, recordingStorageKey: null },
    ]);

    await job.run();

    expect(deletedTranscripts).toEqual([]);
  });

  it("conserva una transcripción sin retention_until: su registro es la prueba de que no se grabó", async () => {
    const { job, deletedTranscripts } = buildJob([
      { id: "t-bloqueada", retentionUntil: null, recordingStorageKey: null },
    ]);

    await job.run();

    expect(deletedTranscripts).toEqual([]);
  });

  it("al borrar una transcripción vencida, borra también el fichero de almacenamiento", async () => {
    const { job, deletedStorageKeys } = buildJob([
      {
        id: "t-con-grabacion",
        retentionUntil: PAST,
        recordingStorageKey: "atlantico/recordings/abc",
      },
    ]);

    await job.run();

    expect(deletedStorageKeys).toEqual(["atlantico/recordings/abc"]);
  });

  it("no intenta borrar ningún fichero si la transcripción no tenía grabación", async () => {
    const { job, deletedStorageKeys, deletedTranscripts } = buildJob([
      { id: "t-sin-grabacion", retentionUntil: PAST, recordingStorageKey: null },
    ]);

    await job.run();

    expect(deletedStorageKeys).toEqual([]);
    expect(deletedTranscripts).toEqual(["t-sin-grabacion"]);
  });

  it("deja constancia en audit_logs con actor_kind system", async () => {
    const { job, auditEntries } = buildJob([
      { id: "t-vencida", retentionUntil: PAST, recordingStorageKey: null },
    ]);

    await job.run();

    expect(auditEntries).toEqual([
      expect.objectContaining({
        schoolId: SCHOOL_ID,
        actorKind: "system",
        entityType: "transcript",
        entityId: "t-vencida",
      }),
    ]);
  });

  it("no audita ni toca lo que se conserva", async () => {
    const { job, auditEntries } = buildJob([
      { id: "t-futura", retentionUntil: FUTURE, recordingStorageKey: null },
      { id: "t-bloqueada", retentionUntil: null, recordingStorageKey: null },
    ]);

    await job.run();

    expect(auditEntries).toEqual([]);
  });
});
