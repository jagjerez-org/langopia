import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { ClsService } from "nestjs-cls";
import { AUDIT_LOG, type AuditLogPort } from "../../../../shared/domain/ports/audit-log.port.js";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import { ID_GENERATOR, type IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import { CLS_SCHOOL_ID } from "../../../../shared/infrastructure/tenant/cls-tenant-context.js";
import {
  IDENTITY_PROVISIONING,
  type IdentityProvisioningPort,
} from "../../../domain/ports/identity-provisioning.port.js";
import {
  INVITATION_REPOSITORY,
  type InvitationRepositoryPort,
} from "../../../domain/ports/invitation-repository.port.js";
import { AcceptInvitationCommand } from "./accept-invitation.command.js";

/**
 * Acepta una invitación. Sin tenant al llegar, igual que el registro de
 * escuela: `schoolIdForToken` resuelve a cuál pertenece el token ANTES de
 * fijar `app.school_id` (ver `InvitationRepositoryPort`), y
 * `findUserIdByAuthUserId` resuelve si la persona ya existe en el dominio
 * por el mismo motivo que en `RegisterSchoolHandler`.
 *
 * Deja rastro en `audit_logs` (saneamiento de cierre de la ola 1): aquí es
 * donde el rol pasa de ser una promesa en `invitations` a ser una fila de
 * `memberships`. `actorMembershipId` es la membresía recién creada —quien
 * acepta es quien la estrena, y no hay ninguna otra suya en esta escuela—,
 * escrita dentro de la MISMA transacción, así que la clave foránea a
 * `memberships` la ve ya insertada.
 */
@CommandHandler(AcceptInvitationCommand)
export class AcceptInvitationHandler implements ICommandHandler<AcceptInvitationCommand> {
  constructor(
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepositoryPort,
    @Inject(IDENTITY_PROVISIONING) private readonly identity: IdentityProvisioningPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly cls: ClsService,
    @Inject(AUDIT_LOG) private readonly auditLog: AuditLogPort,
  ) {}

  async execute(
    command: AcceptInvitationCommand,
  ): Promise<{ schoolId: string; role: string; membershipId: string }> {
    const { props } = command;
    const now = this.clock.now();

    const schoolId = await this.invitations.schoolIdForToken(props.token);
    if (!schoolId) throw new NotFoundError("Invitation", props.token);

    const existingUserId = await this.identity.findUserIdByAuthUserId(props.authUserId);

    this.cls.set(CLS_SCHOOL_ID, schoolId);

    return this.uow.execute(async () => {
      const invitation = await this.invitations.findByToken(props.token);
      if (!invitation) throw new NotFoundError("Invitation", props.token);

      invitation.accept(props.email, now);
      await this.invitations.save(invitation);

      const userId = existingUserId ?? this.ids.generate();
      if (!existingUserId) {
        await this.identity.createUser({
          id: userId,
          authUserId: props.authUserId,
          email: props.email,
          name: props.name,
          emailVerifiedAt: now,
        });
      }

      const membershipId = this.ids.generate();
      await this.identity.addMembership({
        id: membershipId,
        schoolId,
        userId,
        role: invitation.role,
      });

      await this.auditLog.record({
        schoolId,
        actorKind: "user",
        actorMembershipId: membershipId,
        action: "iam.invitation.accepted",
        entityType: "membership",
        entityId: membershipId,
        before: null,
        after: { role: invitation.role, invitationId: invitation.id.value },
      });

      return { schoolId, role: invitation.role, membershipId };
    });
  }
}
