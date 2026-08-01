import { describe, expect, it } from "vitest";
import type { AuditLogEntry, AuditLogPort } from "../../../../shared/domain/ports/audit-log.port.js";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { EventPublisher } from "../../../../shared/domain/ports/event-publisher.port.js";
import type { IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import type { TenantContext } from "../../../../shared/domain/ports/tenant-context.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import type { Invitation } from "../../../domain/model/invitation.aggregate.js";
import type { InvitationRepositoryPort } from "../../../domain/ports/invitation-repository.port.js";
import { InviteMemberCommand } from "./invite-member.command.js";
import { InviteMemberHandler, UnknownMembershipRoleError } from "./invite-member.handler.js";

const ESCUELA = "11111111-1111-4111-8111-111111111111";
const ACTOR = "99999999-9999-4999-8999-999999999999";
const AHORA = new Date("2026-07-27T10:00:00Z");

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeEvents(): EventPublisher {
  return { publish: async () => undefined };
}

function fakeTenant(): TenantContext {
  return {
    schoolId: () => ESCUELA,
    membershipId: () => ACTOR,
    roles: () => ["owner"],
    has: () => true,
  };
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

/** Identificadores previsibles: `id-1` para la invitación, `id-2` para el token. */
function fakeIds(): IdGenerator {
  let n = 0;
  const uuids = [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  ];
  return { generate: () => uuids[n++] ?? "cccccccc-cccc-4ccc-8ccc-cccccccccccc" };
}

function fakeClock(): Clock {
  return { now: () => AHORA };
}

function fakeInvitations(): InvitationRepositoryPort & { saved: Invitation[] } {
  const saved: Invitation[] = [];
  return {
    saved,
    save: async (invitation) => {
      saved.push(invitation);
    },
    findByToken: async () => null,
    schoolIdForToken: async () => null,
  };
}

function construir(auditLog: AuditLogPort, invitations: InvitationRepositoryPort) {
  return new InviteMemberHandler(
    invitations,
    fakeUow(),
    fakeEvents(),
    fakeTenant(),
    fakeClock(),
    fakeIds(),
    auditLog,
  );
}

/**
 * Saneamiento de cierre de la ola 1: este manejador NO escribía en
 * `audit_logs`. Verificado durante la auditoría: se creó una invitación de
 * `admin` y no quedó ninguna fila. Invitar a alguien con rol de
 * administración es de las acciones más sensibles que existen —es conceder
 * un rol por la puerta de delante—, y sin rastro una escuela no puede ver
 * qué hizo soporte dentro de su cuenta. Antes de la corrección, la primera
 * prueba fallaba con `entries` vacío.
 */
describe("InviteMemberHandler — rastro de auditoría", () => {
  it("deja rastro de la invitación, con el rol concedido", async () => {
    const auditLog = fakeAuditLog();
    const invitations = fakeInvitations();
    const handler = construir(auditLog, invitations);

    const result = await handler.execute(
      new InviteMemberCommand({ email: "Nueva.Admin@example.com", role: "admin" }),
    );

    expect(invitations.saved).toHaveLength(1);
    expect(auditLog.entries).toHaveLength(1);
    expect(auditLog.entries[0]).toMatchObject({
      schoolId: ESCUELA,
      actorKind: "user",
      actorMembershipId: ACTOR,
      action: "iam.member.invited",
      entityType: "invitation",
      entityId: result.invitationId,
      before: null,
      after: { email: "nueva.admin@example.com", role: "admin" },
    });
  });

  it("el rastro no guarda el token: quien lo lea no puede aceptar la invitación", async () => {
    // El registro de auditoría lo lee la escuela entera. Un token ahí dentro
    // convierte la pantalla de auditoría en una vía para entrar como otro.
    const auditLog = fakeAuditLog();
    const invitations = fakeInvitations();
    const result = await construir(auditLog, invitations).execute(
      new InviteMemberCommand({ email: "alguien@example.com", role: "teacher" }),
    );

    expect(JSON.stringify(auditLog.entries)).not.toContain(result.token);
  });

  it("no deja rastro si el rol pedido no existe", async () => {
    const auditLog = fakeAuditLog();
    const invitations = fakeInvitations();

    await expect(
      construir(auditLog, invitations).execute(
        new InviteMemberCommand({ email: "alguien@example.com", role: "superadmin" }),
      ),
    ).rejects.toThrow(UnknownMembershipRoleError);

    expect(invitations.saved).toHaveLength(0);
    expect(auditLog.entries).toHaveLength(0);
  });
});
