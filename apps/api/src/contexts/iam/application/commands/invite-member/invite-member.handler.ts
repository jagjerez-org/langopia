import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { DomainError } from "../../../../shared/domain/errors/domain-error.js";
import { AUDIT_LOG, type AuditLogPort } from "../../../../shared/domain/ports/audit-log.port.js";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import { ID_GENERATOR, type IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { Invitation, InvitationId, MEMBERSHIP_ROLES } from "../../../domain/model/invitation.aggregate.js";
import type { MembershipRoleName } from "../../../domain/model/invitation.aggregate.js";
import {
  INVITATION_REPOSITORY,
  type InvitationRepositoryPort,
} from "../../../domain/ports/invitation-repository.port.js";
import { InviteMemberCommand } from "./invite-member.command.js";

export class UnknownMembershipRoleError extends DomainError {
  readonly code = "unknown_membership_role";
  readonly kind = "invalid_input" as const;

  constructor(value: string, allowed: readonly string[]) {
    super(`«${value}» no es un rol de membresía conocido.`, { value, allowed });
  }
}

function assertMembershipRole(value: string): MembershipRoleName {
  if ((MEMBERSHIP_ROLES as readonly string[]).includes(value)) return value as MembershipRoleName;
  throw new UnknownMembershipRoleError(value, MEMBERSHIP_ROLES);
}

/**
 * Invita a alguien a la escuela activa.
 *
 * Ruta normal, dentro de tenant: quien invita ya está autenticado y
 * pertenece a la escuela (`@Roles("owner", "admin")` en el controlador). No
 * hay huevo y la gallina aquí — eso es cosa de `AcceptInvitationHandler`.
 *
 * Deja rastro en `audit_logs` (saneamiento de cierre de la ola 1): invitar a
 * alguien con rol de administración es conceder ese rol por la puerta de
 * delante, y sin fila de auditoría una escuela no puede ver qué hizo soporte
 * dentro de su cuenta. Se registra DENTRO de la misma transacción que la
 * invitación: o constan las dos cosas o no consta ninguna. El `token` NO se
 * guarda —el registro de auditoría lo lee la escuela entera, y ahí dentro
 * sería una llave para entrar como otro—; sí el correo y el rol, que son
 * justo lo que la acción concede y lo que ya guarda `invitations`.
 */
@CommandHandler(InviteMemberCommand)
export class InviteMemberHandler implements ICommandHandler<InviteMemberCommand> {
  constructor(
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(AUDIT_LOG) private readonly auditLog: AuditLogPort,
  ) {}

  async execute(
    command: InviteMemberCommand,
  ): Promise<{ invitationId: string; token: string; expiresAt: string }> {
    const { props } = command;
    const role = assertMembershipRole(props.role);
    const now = this.clock.now();

    const invitation = await this.uow.execute(async () => {
      const created = Invitation.invite({
        id: InvitationId.of(this.ids.generate()),
        schoolId: this.tenant.schoolId(),
        email: props.email,
        role,
        token: this.ids.generate(),
        now,
      });
      await this.invitations.save(created);
      await this.auditLog.record({
        schoolId: created.schoolId,
        actorKind: "user",
        actorMembershipId: this.tenant.membershipId(),
        action: "iam.member.invited",
        entityType: "invitation",
        entityId: created.id.value,
        before: null,
        after: { email: created.email, role: created.role },
      });
      return created;
    });

    await this.events.publish(invitation.pullDomainEvents());

    return {
      invitationId: invitation.id.value,
      token: invitation.token,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }
}
