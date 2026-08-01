import { ClsService } from "nestjs-cls";
import { describe, expect, it } from "vitest";
import type { AuditLogEntry, AuditLogPort } from "../../../../shared/domain/ports/audit-log.port.js";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import type { IdentityProvisioningPort } from "../../../domain/ports/identity-provisioning.port.js";
import type { SchoolRepositoryPort } from "../../../domain/ports/school-repository.port.js";
import type { TrialSubscriptionPort } from "../../../domain/ports/trial-subscription.port.js";
import { RegisterSchoolCommand } from "./register-school.command.js";
import { RegisterSchoolHandler } from "./register-school.handler.js";

const AHORA = new Date("2026-07-27T10:00:00Z");
const ESCUELA = "11111111-1111-4111-8111-111111111111";
const PERSONA = "22222222-2222-4222-8222-222222222222";
const MEMBRESIA = "33333333-3333-4333-8333-333333333333";
const SUSCRIPCION = "44444444-4444-4444-8444-444444444444";

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeClock(): Clock {
  return { now: () => AHORA };
}

function fakeIds(): IdGenerator {
  let n = 0;
  const uuids = [ESCUELA, PERSONA, MEMBRESIA, SUSCRIPCION];
  return { generate: () => uuids[n++] ?? "55555555-5555-4555-8555-555555555555" };
}

function fakeCls(): ClsService {
  const store = new Map<string, unknown>();
  return {
    set: (key: string, value: unknown) => store.set(key, value),
    get: (key: string) => store.get(key),
  } as unknown as ClsService;
}

function fakeAuditLog(): AuditLogPort & { entries: AuditLogEntry[] } {
  const entries: AuditLogEntry[] = [];
  return {
    entries,
    record: async (entry) => {
      entries.push(entry);
    },
  };
}

function fakeSchools(): SchoolRepositoryPort {
  return {
    save: async () => undefined,
    existsBySlug: async () => false,
    findCurrent: async () => null,
    updateSettings: async () => {
      throw new Error("no usado en esta prueba");
    },
  };
}

function fakeIdentity(): IdentityProvisioningPort {
  return {
    findUserIdByAuthUserId: async () => null,
    createUser: async () => undefined,
    addMembership: async () => undefined,
  };
}

function fakeTrial(): TrialSubscriptionPort {
  return { start: async () => undefined };
}

/**
 * Saneamiento de cierre de la ola 1: el alta de escuela concede la primera
 * membresía `owner` de la escuela, y no dejaba rastro. Es la fila cero del
 * registro de auditoría de esa escuela: sin ella, «¿de dónde salió este
 * `owner`?» no tiene respuesta en `audit_logs`.
 */
describe("RegisterSchoolHandler — rastro de auditoría", () => {
  it("deja rastro del alta y de la membresía de dueño que la abre", async () => {
    const auditLog = fakeAuditLog();
    const handler = new RegisterSchoolHandler(
      fakeSchools(),
      fakeIdentity(),
      fakeTrial(),
      fakeUow(),
      fakeClock(),
      fakeIds(),
      fakeCls(),
      auditLog,
    );

    const result = await handler.execute(
      new RegisterSchoolCommand({
        slug: "academia-nueva",
        name: "Academia Nueva",
        ownerAuthUserId: "auth-user-1",
        ownerEmail: "duena@example.com",
        ownerName: "Dueña",
      }),
    );

    expect(result.schoolId).toBe(ESCUELA);
    expect(auditLog.entries).toHaveLength(1);
    expect(auditLog.entries[0]).toMatchObject({
      schoolId: ESCUELA,
      // No hay nadie con membresía en la escuela ANTES de que exista la
      // escuela: la que se crea aquí es la primera, y es la del actor.
      actorKind: "user",
      actorMembershipId: MEMBRESIA,
      action: "iam.school.registered",
      entityType: "school",
      entityId: ESCUELA,
      before: null,
      after: { slug: "academia-nueva", ownerMembershipId: MEMBRESIA },
    });
  });
});
