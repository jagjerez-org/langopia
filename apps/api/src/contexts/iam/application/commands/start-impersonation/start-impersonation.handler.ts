import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { ClsService } from "nestjs-cls";
import { AUDIT_LOG, type AuditLogPort } from "../../../../shared/domain/ports/audit-log.port.js";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from "../../../../shared/domain/ports/event-publisher.port.js";
import { ID_GENERATOR, type IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import { CLS_SCHOOL_ID } from "../../../../shared/infrastructure/tenant/cls-tenant-context.js";
import { Impersonation, ImpersonationId } from "../../../domain/model/impersonation.aggregate.js";
import { assertCanImpersonate } from "../../../domain/model/impersonation-rules.js";
import type { MembershipRoleName } from "../../../domain/model/invitation.aggregate.js";
import {
  IDENTITY_PROVISIONING,
  type IdentityProvisioningPort,
} from "../../../domain/ports/identity-provisioning.port.js";
import {
  IMPERSONATION_DIRECTORY,
  type ImpersonationDirectoryPort,
} from "../../../domain/ports/impersonation-directory.port.js";
import {
  IMPERSONATION_REPOSITORY,
  type ImpersonationRepositoryPort,
} from "../../../domain/ports/impersonation-repository.port.js";
import {
  MEMBERSHIP_LOOKUP,
  type MembershipLookupPort,
} from "../../../domain/ports/membership-lookup.port.js";
import {
  MINOR_GUARDIAN_LOOKUP,
  type MinorGuardianLookupPort,
} from "../../../domain/ports/minor-guardian-lookup.port.js";
import { StartImpersonationCommand } from "./start-impersonation.command.js";

/**
 * Empieza una impersonación.
 *
 * No hay tenant que resolver de la forma normal: soporte de la plataforma no
 * tiene por qué pertenecer a la escuela de destino, así que este comando —y
 * el controlador que lo invoca, `@Public()` frente a `SessionTenantGuard`—
 * resuelve la identidad de quien llama a mano, con el mismo patrón que
 * `RegisterSchoolHandler` usa para el alta de escuela: una sesión de Better
 * Auth verificada, sin membresía todavía resuelta por el guardia.
 *
 * Las preguntas de ANTES de fijar tenant (`ImpersonationDirectoryPort`) y las
 * de DESPUÉS (`ImpersonationRepositoryPort`, dentro de `uow.execute()` con
 * el tenant ya fijado a la escuela de LA PERSONA IMPERSONADA) están
 * deliberadamente separadas: son exactamente las dos mitades del mismo
 * huevo-y-gallina que ya resuelve `SessionTenantGuard`.
 */
@CommandHandler(StartImpersonationCommand)
export class StartImpersonationHandler implements ICommandHandler<StartImpersonationCommand> {
  constructor(
    @Inject(IMPERSONATION_DIRECTORY) private readonly directory: ImpersonationDirectoryPort,
    @Inject(MEMBERSHIP_LOOKUP) private readonly memberships: MembershipLookupPort,
    @Inject(IDENTITY_PROVISIONING) private readonly identity: IdentityProvisioningPort,
    @Inject(IMPERSONATION_REPOSITORY) private readonly repository: ImpersonationRepositoryPort,
    @Inject(MINOR_GUARDIAN_LOOKUP) private readonly minorGuardians: MinorGuardianLookupPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @Inject(AUDIT_LOG) private readonly auditLog: AuditLogPort,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly cls: ClsService,
  ) {}

  async execute(command: StartImpersonationCommand) {
    const { targetMembershipId, reason, actorAuthUserId, actorEmail, actorName } = command.props;
    const now = this.clock.now();

    const targetSchoolId = await this.directory.schoolIdForMembership(targetMembershipId);
    if (!targetSchoolId) throw new NotFoundError("membresía", targetMembershipId);

    const [isPlatformSupport, actorOwnMemberships, actorActiveImpersonation, actorBeingImpersonated, actorUserId] =
      await Promise.all([
        this.directory.isPlatformSupport(actorAuthUserId),
        this.memberships.activeFor(actorAuthUserId),
        this.directory.activeAsImpersonator(actorAuthUserId),
        this.directory.isBeingImpersonated(actorAuthUserId),
        this.identity.findUserIdByAuthUserId(actorAuthUserId),
      ]);

    if (!actorUserId) throw new NotFoundError("usuario", actorAuthUserId);

    const actorMembershipInTargetSchool =
      actorOwnMemberships.find((m) => m.schoolId === targetSchoolId) ?? null;

    // Sin tenant resuelto por el guardia (esta ruta es `@Public()` frente a
    // `SessionTenantGuard`: soporte de la plataforma puede no pertenecer a
    // ninguna escuela), `uow.execute()` fijaría `app.school_id` preguntando a
    // `TenantContext` y no encontraría nada. Se fija aquí, a la escuela de LA
    // PERSONA IMPERSONADA — mismo truco que `RegisterSchoolHandler` con la
    // escuela que está a punto de crear.
    this.cls.set(CLS_SCHOOL_ID, targetSchoolId);

    const impersonation = await this.uow.execute(async () => {
      const target = await this.repository.findTargetMembership(targetMembershipId);
      if (!target) throw new NotFoundError("membresía", targetMembershipId);

      const targetActiveImpersonation = target.authUserId
        ? await this.directory.activeAsImpersonator(target.authUserId)
        : null;

      assertCanImpersonate(
        {
          kind: isPlatformSupport ? "platform_support" : "membership",
          membershipId: actorMembershipInTargetSchool?.membershipId ?? null,
          roles: actorMembershipInTargetSchool
            ? [actorMembershipInTargetSchool.role as MembershipRoleName]
            : [],
          isCurrentlyImpersonating: actorActiveImpersonation !== null,
          isCurrentlyBeingImpersonated: actorBeingImpersonated,
        },
        {
          membershipId: targetMembershipId,
          role: target.role,
          isCurrentlyImpersonatingSomeoneElse: targetActiveImpersonation !== null,
        },
      );

      const minorContext = await this.minorGuardians.contextFor(targetMembershipId);
      const impersonatorMembershipId = actorMembershipInTargetSchool?.membershipId ?? null;

      const created = Impersonation.start({
        id: ImpersonationId.of(this.ids.generate()),
        schoolId: targetSchoolId,
        targetMembershipId,
        impersonatorUserId: actorUserId,
        impersonatorMembershipId,
        impersonatorName: actorName,
        impersonatorEmail: actorEmail,
        reason,
        involvesMinor: minorContext.isMinor,
        guardianMembershipIds: minorContext.guardianMembershipIds,
        now,
      });

      await this.repository.save(created);

      // Auditoría explícita: en este punto no hay CLS de impersonación que
      // detectar solo (la petición llegó por la ruta pública), así que se
      // pasan `actorKind` e `impersonatorMembershipId` a mano — ver el
      // comentario de `DrizzleAuditLogRepository.record`.
      await this.auditLog.record({
        schoolId: targetSchoolId,
        actorKind: "impersonation",
        actorMembershipId: targetMembershipId,
        impersonatorMembershipId,
        action: "iam.impersonation.started",
        entityType: "impersonation",
        entityId: created.id.value,
        after: {
          reason: created.reason,
          involvesMinor: created.involvesMinor,
          expiresAt: created.expiresAt.toISOString(),
        },
      });

      return created;
    });

    await this.events.publish(impersonation.pullDomainEvents());

    return {
      impersonationId: impersonation.id.value,
      targetMembershipId,
      reason: impersonation.reason,
      involvesMinor: impersonation.involvesMinor,
      expiresAt: impersonation.expiresAt.toISOString(),
    };
  }
}
