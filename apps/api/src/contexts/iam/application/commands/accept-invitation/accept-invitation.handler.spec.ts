import { ClsService } from "nestjs-cls";
import { describe, expect, it } from "vitest";
import type { AuditLogEntry, AuditLogPort } from "../../../../shared/domain/ports/audit-log.port.js";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { Invitation, InvitationId } from "../../../domain/model/invitation.aggregate.js";
import type { IdentityProvisioningPort } from "../../../domain/ports/identity-provisioning.port.js";
import type { InvitationRepositoryPort } from "../../../domain/ports/invitation-repository.port.js";
import { AcceptInvitationCommand } from "./accept-invitation.command.js";
import { AcceptInvitationHandler } from "./accept-invitation.handler.js";

const ESCUELA = "11111111-1111-4111-8111-111111111111";
const INVITACION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AHORA = new Date("2026-07-27T10:00:00Z");
const TOKEN = "token-de-la-invitacion";

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeClock(): Clock {
  return { now: () => AHORA };
}

function fakeIds(): IdGenerator {
  let n = 0;
  const uuids = [
    "22222222-2222-4222-8222-222222222222", // users.id
    "33333333-3333-4333-8333-333333333333", // memberships.id
  ];
  return { generate: () => uuids[n++] ?? "44444444-4444-4444-8444-444444444444" };
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

function invitacion(role: "owner" | "admin" | "teacher" | "student" | "guardian" = "admin") {
  return Invitation.invite({
    id: InvitationId.of(INVITACION),
    schoolId: ESCUELA,
    email: "nueva.admin@example.com",
    role,
    token: TOKEN,
    now: AHORA,
  });
}

function fakeInvitations(pendiente: Invitation): InvitationRepositoryPort {
  return {
    save: async () => undefined,
    findByToken: async () => pendiente,
    schoolIdForToken: async () => ESCUELA,
  };
}

function fakeIdentity(): IdentityProvisioningPort & { memberships: { role: string }[] } {
  const memberships: { role: string }[] = [];
  return {
    memberships,
    findUserIdByAuthUserId: async () => null,
    createUser: async () => undefined,
    addMembership: async (props) => {
      memberships.push({ role: props.role });
    },
  };
}

/**
 * Saneamiento de cierre de la ola 1: aceptar una invitación CREA la
 * membresía, es decir, concede el rol de verdad. Sin rastro, la única huella
 * de una escalada a `admin` era la propia fila de `memberships`, que no dice
 * ni cuándo ni por qué invitación. Antes de la corrección, `entries` quedaba
 * vacío.
 */
describe("AcceptInvitationHandler — rastro de auditoría", () => {
  it("deja rastro de la membresía concedida", async () => {
    const auditLog = fakeAuditLog();
    const identity = fakeIdentity();
    const handler = new AcceptInvitationHandler(
      fakeInvitations(invitacion("admin")),
      identity,
      fakeUow(),
      fakeClock(),
      fakeIds(),
      fakeCls(),
      auditLog,
    );

    const result = await handler.execute(
      new AcceptInvitationCommand({
        token: TOKEN,
        authUserId: "auth-user-1",
        email: "nueva.admin@example.com",
        name: "Nueva Admin",
      }),
    );

    expect(identity.memberships).toEqual([{ role: "admin" }]);
    expect(auditLog.entries).toHaveLength(1);
    expect(auditLog.entries[0]).toMatchObject({
      schoolId: ESCUELA,
      actorKind: "user",
      actorMembershipId: result.membershipId,
      action: "iam.invitation.accepted",
      entityType: "membership",
      entityId: result.membershipId,
      before: null,
      after: { role: "admin", invitationId: INVITACION },
    });
  });

  it("no deja rastro si la invitación no es para ese correo", async () => {
    const auditLog = fakeAuditLog();
    const identity = fakeIdentity();
    const handler = new AcceptInvitationHandler(
      fakeInvitations(invitacion("admin")),
      identity,
      fakeUow(),
      fakeClock(),
      fakeIds(),
      fakeCls(),
      auditLog,
    );

    await expect(
      handler.execute(
        new AcceptInvitationCommand({
          token: TOKEN,
          authUserId: "auth-user-2",
          email: "otra.persona@example.com",
          name: "Otra Persona",
        }),
      ),
    ).rejects.toThrow(/no es para tu correo/i);

    expect(identity.memberships).toHaveLength(0);
    expect(auditLog.entries).toHaveLength(0);
  });
});
