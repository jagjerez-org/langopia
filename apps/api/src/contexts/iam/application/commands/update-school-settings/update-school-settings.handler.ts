import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { AUDIT_LOG, type AuditLogPort } from "../../../../shared/domain/ports/audit-log.port.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import {
  SCHOOL_REPOSITORY,
  type SchoolRepositoryPort,
} from "../../../domain/ports/school-repository.port.js";
import type { SchoolSettingsResult } from "../../queries/get-school-settings/get-school-settings.handler.js";
import { UpdateSchoolSettingsCommand } from "./update-school-settings.command.js";

/**
 * Ajustes de "marca" e "idiomas" del asistente de puesta en marcha (Tarea 12
 * del panel): el nombre público de la escuela y su idioma por defecto.
 *
 * Sin agregado `School` de por medio: no hay ninguna regla de negocio que
 * decidir (cualquier nombre no vacío vale — ya lo comprueba el DTO —, y
 * cualquiera de los cinco idiomas soportados vale — también el DTO,
 * `@IsIn(SUPPORTED_LOCALES)`), así que esto es leer, escribir y dejar
 * rastro, igual que `MeController` no pasa por un agregado para lo que ya no
 * decide nada.
 *
 * Cuando `defaultLocale` cambia, `supportedLocales` se fija a ese único
 * valor: si se quedara con lo que ya hubiera (`['es-ES']` por defecto de
 * fábrica), una escuela que elige alemán como idioma por defecto podría
 * terminar sin poder dar de alta ningún curso — `CreateCourseDialog` del
 * panel solo pinta un campo de traducción por cada idioma de
 * `supportedLocales`, y `Course.create()` exige la traducción del idioma por
 * DEFECTO. Ampliar a varios idiomas soportados a la vez queda para una
 * pantalla de ajustes propia, fuera del alcance de esta tarea.
 */
@CommandHandler(UpdateSchoolSettingsCommand)
export class UpdateSchoolSettingsHandler implements ICommandHandler<UpdateSchoolSettingsCommand> {
  constructor(
    @Inject(SCHOOL_REPOSITORY) private readonly schools: SchoolRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(AUDIT_LOG) private readonly auditLog: AuditLogPort,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  async execute(command: UpdateSchoolSettingsCommand): Promise<SchoolSettingsResult> {
    const { props } = command;
    const hasChange = props.name !== undefined || props.defaultLocale !== undefined;

    const settings = await this.uow.execute(async () => {
      const before = await this.schools.findCurrent();

      if (!hasChange) return before;

      const after = await this.schools.updateSettings({
        name: props.name,
        defaultLocale: props.defaultLocale,
        supportedLocales: props.defaultLocale !== undefined ? [props.defaultLocale] : undefined,
      });

      await this.auditLog.record({
        schoolId: this.tenant.schoolId(),
        actorKind: "user",
        actorMembershipId: this.tenant.membershipId(),
        action: "iam.school.settings_updated",
        entityType: "school",
        entityId: this.tenant.schoolId(),
        before: before ? { name: before.name, defaultLocale: before.defaultLocale } : null,
        after: { name: after.name, defaultLocale: after.defaultLocale },
      });

      return after;
    });

    if (!settings) throw new Error("La escuela activa no existe.");
    return {
      name: settings.name,
      defaultLocale: settings.defaultLocale,
      supportedLocales: settings.supportedLocales,
      status: settings.status,
      trialEndsAt: settings.trialEndsAt ? settings.trialEndsAt.toISOString() : null,
    };
  }
}
