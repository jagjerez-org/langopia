import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { ClsService } from "nestjs-cls";
import { AUDIT_LOG, type AuditLogPort } from "../../../../shared/domain/ports/audit-log.port.js";
import { CLOCK, type Clock } from "../../../../shared/domain/ports/clock.port.js";
import { ID_GENERATOR, type IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import { CLS_SCHOOL_ID } from "../../../../shared/infrastructure/tenant/cls-tenant-context.js";
import { INITIAL_PLAN_CODE, School } from "../../../domain/model/school.aggregate.js";
import { SchoolSlug } from "../../../domain/model/school-slug.vo.js";
import {
  IDENTITY_PROVISIONING,
  type IdentityProvisioningPort,
} from "../../../domain/ports/identity-provisioning.port.js";
import { SCHOOL_REPOSITORY, type SchoolRepositoryPort } from "../../../domain/ports/school-repository.port.js";
import {
  TRIAL_SUBSCRIPTION,
  type TrialSubscriptionPort,
} from "../../../domain/ports/trial-subscription.port.js";
import { RegisterSchoolCommand } from "./register-school.command.js";

/**
 * Alta de escuela nueva, autoservicio.
 *
 * Es la única ruta del sistema que corre SIN tenant, porque el tenant
 * todavía no existe. Dos huecos que resolver, y los dos acotados:
 *
 *   1. `schools` tiene RLS con `WITH CHECK (id = current_school_id())`, así
 *      que insertarla exige que `app.school_id` valga YA su propio id. El id
 *      lo genera este comando (`ID_GENERATOR`, no la base de datos —ver
 *      `id-generator.port.ts`), así que puede fijarlo en CLS ANTES de abrir
 *      la transacción. Ni política nueva ni `BYPASSRLS`: la escuela entra
 *      dentro de su propio tenant, como cualquier otra fila suya. Mismo
 *      truco que ya usa `PurgeExpiredRecordingsJob` con escuelas que sí
 *      existen.
 *   2. Saber si esta credencial de Better Auth ya tiene una persona del
 *      dominio atada (alguien que da clase en otra escuela y ahora abre la
 *      suya) exige preguntar ANTES de fijar tenant: la política de `users`
 *      solo hace visible a quien ya tiene membresía en la escuela ACTUAL, y
 *      esta escuela nueva no tiene ninguna todavía. Ver
 *      `IdentityProvisioningPort.findUserIdByAuthUserId`.
 */
@CommandHandler(RegisterSchoolCommand)
export class RegisterSchoolHandler implements ICommandHandler<RegisterSchoolCommand> {
  constructor(
    @Inject(SCHOOL_REPOSITORY) private readonly schools: SchoolRepositoryPort,
    @Inject(IDENTITY_PROVISIONING) private readonly identity: IdentityProvisioningPort,
    @Inject(TRIAL_SUBSCRIPTION) private readonly trial: TrialSubscriptionPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly cls: ClsService,
    @Inject(AUDIT_LOG) private readonly auditLog: AuditLogPort,
  ) {}

  async execute(command: RegisterSchoolCommand): Promise<{ schoolId: string; slug: string }> {
    const { props } = command;
    const slug = SchoolSlug.of(props.slug);
    const now = this.clock.now();
    const schoolId = this.ids.generate();

    const existingUserId = await this.identity.findUserIdByAuthUserId(props.ownerAuthUserId);
    const ownerUserId = existingUserId ?? this.ids.generate();

    const school = School.register({
      id: SchoolId.of(schoolId),
      slug,
      name: props.name,
      ownerUserId,
      now,
    });

    this.cls.set(CLS_SCHOOL_ID, schoolId);

    await this.uow.execute(async () => {
      await this.schools.save(school);

      if (!existingUserId) {
        await this.identity.createUser({
          id: ownerUserId,
          authUserId: props.ownerAuthUserId,
          email: props.ownerEmail,
          name: props.ownerName,
          emailVerifiedAt: now,
        });
      }

      const ownerMembershipId = this.ids.generate();
      await this.identity.addMembership({
        id: ownerMembershipId,
        schoolId,
        userId: ownerUserId,
        role: "owner",
      });

      // Fila cero del registro de auditoría de esta escuela: de aquí sale su
      // primer `owner`. Va DESPUÉS de `addMembership` porque
      // `audit_logs.actor_membership_id` apunta a `memberships`, y dentro de
      // la misma transacción para que ninguna de las dos pueda quedar sola.
      await this.auditLog.record({
        schoolId,
        actorKind: "user",
        actorMembershipId: ownerMembershipId,
        action: "iam.school.registered",
        entityType: "school",
        entityId: schoolId,
        before: null,
        after: { slug: school.slug.value, ownerMembershipId },
      });

      await this.trial.start({
        id: this.ids.generate(),
        schoolId,
        planCode: INITIAL_PLAN_CODE,
        startsAt: now,
        endsAt: school.trialEndsAt,
      });
    });

    return { schoolId, slug: school.slug.value };
  }
}
