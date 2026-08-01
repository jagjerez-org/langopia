import { describe, expect, it } from "vitest";
import type { AuditLogEntry, AuditLogPort } from "../../../../shared/domain/ports/audit-log.port.js";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import type { TenantContext } from "../../../../shared/domain/ports/tenant-context.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import {
  PersonAlreadyErasedError,
  PersonHasOtherSchoolMembershipsError,
} from "../../../domain/errors/personal-data.errors.js";
import type {
  PersonErasureRepository,
  PersonEraseTarget,
  PrivateRecording,
} from "../../../domain/ports/person-erasure.port.js";
import type { RecordingStoragePort } from "../../../domain/ports/recording-storage.port.js";
import { ErasePersonCommand } from "./erase-person.command.js";
import { ErasePersonHandler } from "./erase-person.handler.js";

const AHORA = new Date("2026-07-27T12:00:00Z");
const ESCUELA = "11111111-1111-4111-8111-111111111111";

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeClock(): Clock {
  return { now: () => AHORA };
}

function fakeIds(): IdGenerator {
  let n = 0;
  return { generate: () => `marker-${++n}` };
}

function fakeTenant(): TenantContext {
  return {
    schoolId: () => ESCUELA,
    membershipId: () => "owner-1",
    roles: () => ["owner"],
    has: () => true,
  };
}

function fakeAuditLog(): AuditLogPort & { entries: AuditLogEntry[] } {
  const entries: AuditLogEntry[] = [];
  return { entries, record: async (entry) => void entries.push(entry) };
}

function fakeStorage(): RecordingStoragePort & { deleted: string[] } {
  const deleted: string[] = [];
  return { deleted, delete: async (key) => void deleted.push(key) };
}

type FakeErasureOptions = {
  target?: PersonEraseTarget | null;
  alreadyErased?: boolean;
  otherSchoolMemberships?: boolean;
  privateRecordings?: PrivateRecording[];
  segmentsAnonymized?: number;
};

function fakeErasure(options: FakeErasureOptions = {}): PersonErasureRepository & {
  pseudonymizeCalls: Array<{ userId: string; nameMarker: string; emailMarker: string }>;
  clearedRecordings: string[];
  privateRecordingsCalls: string[];
} {
  const pseudonymizeCalls: Array<{ userId: string; nameMarker: string; emailMarker: string }> = [];
  const clearedRecordings: string[] = [];
  const privateRecordingsCalls: string[] = [];

  return {
    pseudonymizeCalls,
    clearedRecordings,
    privateRecordingsCalls,
    findTarget: async () =>
      options.target !== undefined
        ? options.target
        : {
            membershipId: "student-1",
            userId: "user-1",
            role: "student",
            studentProfileId: "sp-1",
          },
    isAlreadyErased: async () => options.alreadyErased ?? false,
    hasOtherActiveSchoolMemberships: async () => options.otherSchoolMemberships ?? false,
    pseudonymizeIdentity: async (params) => void pseudonymizeCalls.push(params),
    privateRecordingsOf: async (studentProfileId) => {
      privateRecordingsCalls.push(studentProfileId);
      return options.privateRecordings ?? [];
    },
    clearRecording: async (transcriptId) => void clearedRecordings.push(transcriptId),
    anonymizeSpeakerSegments: async () => options.segmentsAnonymized ?? 0,
  };
}

describe("ErasePersonHandler (Tarea 15)", () => {
  it("seudonimiza nombre y correo, y deja constancia en audit_logs sin filtrar el dato real", async () => {
    const erasure = fakeErasure();
    const auditLog = fakeAuditLog();
    const handler = new ErasePersonHandler(
      erasure,
      fakeStorage(),
      fakeUow(),
      auditLog,
      fakeTenant(),
      fakeClock(),
      fakeIds(),
    );

    const result = await handler.execute(new ErasePersonCommand({ membershipId: "student-1" }));

    expect(result.membershipId).toBe("student-1");
    expect(erasure.pseudonymizeCalls).toHaveLength(1);
    expect(erasure.pseudonymizeCalls[0]!.userId).toBe("user-1");
    expect(erasure.pseudonymizeCalls[0]!.emailMarker).toMatch(/@erased\.invalid$/);
    expect(erasure.pseudonymizeCalls[0]!.nameMarker).not.toMatch(/@/);

    expect(auditLog.entries).toHaveLength(1);
    expect(auditLog.entries[0]).toMatchObject({
      schoolId: ESCUELA,
      actorKind: "user",
      action: "iam.person.erased",
      entityType: "membership",
      entityId: "student-1",
    });
    // El registro de auditoría no debe contener el nombre ni el correo reales:
    // eso reintroduciría justo el dato que el borrado existe para eliminar.
    const serialized = JSON.stringify(auditLog.entries[0]);
    expect(serialized).not.toMatch(/@erased\.invalid/); // ni siquiera el marcador hace falta aquí
  });

  it("las facturas no se tocan: el puerto de borrado no tiene ningún método sobre invoices", () => {
    // Prueba de compilación, no de comportamiento: si alguien añadiera un
    // método que mutase importes al puerto, esta prueba seguiría en verde
    // porque el tipo lo permitiría — la garantía real es que
    // `PersonErasureRepository` (person-erasure.port.ts) no declara nada
    // sobre `invoices`. La conservación del IMPORTE se verifica contra el
    // seed real en el informe de la Tarea 15 (recuentos antes/después).
    const erasure = fakeErasure();
    expect(Object.keys(erasure)).not.toContain("voidInvoice");
    expect(Object.keys(erasure)).not.toContain("adjustInvoiceAmount");
  });

  it("borra el fichero de una grabación exclusiva de este alumno (clase 1 a 1)", async () => {
    const recording: PrivateRecording = {
      transcriptId: "tr-1",
      recordingStorageKey: "atlantico/recordings/tr-1",
    };
    const erasure = fakeErasure({ privateRecordings: [recording] });
    const storage = fakeStorage();
    const handler = new ErasePersonHandler(
      erasure,
      storage,
      fakeUow(),
      fakeAuditLog(),
      fakeTenant(),
      fakeClock(),
      fakeIds(),
    );

    const result = await handler.execute(new ErasePersonCommand({ membershipId: "student-1" }));

    expect(storage.deleted).toEqual(["atlantico/recordings/tr-1"]);
    expect(erasure.clearedRecordings).toEqual(["tr-1"]);
    expect(result.recordingsDeleted).toBe(1);
  });

  it("anonimiza los segmentos donde habló, sin borrar transcripciones compartidas", async () => {
    const erasure = fakeErasure({ segmentsAnonymized: 3 });
    const handler = new ErasePersonHandler(
      erasure,
      fakeStorage(),
      fakeUow(),
      fakeAuditLog(),
      fakeTenant(),
      fakeClock(),
      fakeIds(),
    );

    const result = await handler.execute(new ErasePersonCommand({ membershipId: "student-1" }));

    expect(result.segmentsAnonymized).toBe(3);
  });

  it("un profesor erased nunca revisa grabaciones: no tiene studentProfileId", async () => {
    const erasure = fakeErasure({
      target: { membershipId: "teacher-1", userId: "user-2", role: "teacher", studentProfileId: null },
    });
    const handler = new ErasePersonHandler(
      erasure,
      fakeStorage(),
      fakeUow(),
      fakeAuditLog(),
      fakeTenant(),
      fakeClock(),
      fakeIds(),
    );

    const result = await handler.execute(new ErasePersonCommand({ membershipId: "teacher-1" }));

    expect(erasure.privateRecordingsCalls).toHaveLength(0);
    expect(result.recordingsDeleted).toBe(0);
  });

  it("404 si la membresía no existe en esta escuela", async () => {
    const handler = new ErasePersonHandler(
      fakeErasure({ target: null }),
      fakeStorage(),
      fakeUow(),
      fakeAuditLog(),
      fakeTenant(),
      fakeClock(),
      fakeIds(),
    );

    await expect(
      handler.execute(new ErasePersonCommand({ membershipId: "no-existe" })),
    ).rejects.toThrow(/no existe/i);
  });

  it("rechaza repetir el borrado sobre una persona ya erased", async () => {
    const handler = new ErasePersonHandler(
      fakeErasure({ alreadyErased: true }),
      fakeStorage(),
      fakeUow(),
      fakeAuditLog(),
      fakeTenant(),
      fakeClock(),
      fakeIds(),
    );

    await expect(
      handler.execute(new ErasePersonCommand({ membershipId: "student-1" })),
    ).rejects.toThrow(PersonAlreadyErasedError);
  });

  it("rechaza el borrado si la persona tiene otra membresía activa en otra escuela", async () => {
    const erasure = fakeErasure({ otherSchoolMemberships: true });
    const handler = new ErasePersonHandler(
      erasure,
      fakeStorage(),
      fakeUow(),
      fakeAuditLog(),
      fakeTenant(),
      fakeClock(),
      fakeIds(),
    );

    await expect(
      handler.execute(new ErasePersonCommand({ membershipId: "teacher-1" })),
    ).rejects.toThrow(PersonHasOtherSchoolMembershipsError);
    // Ni un solo cambio si el guardia lo bloquea: nada de borrado a medias.
    expect(erasure.pseudonymizeCalls).toHaveLength(0);
  });
});
