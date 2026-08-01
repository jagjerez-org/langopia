import { Inject, Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import type { AuditLogEntry, AuditLogPort } from "../../domain/ports/audit-log.port.js";
import { TENANT_CONTEXT, type TenantContext } from "../../domain/ports/tenant-context.port.js";
import { DrizzleService } from "./drizzle.service.js";

/**
 * Igual que cualquier otro repositorio: escribe dentro de la transacción en
 * curso (`this.drizzle.db`), así que hereda el `app.school_id` que haya
 * fijado la unidad de trabajo. Sin eso, el `INSERT` lo rechazaría el `WITH
 * CHECK` de la política de `audit_logs`.
 *
 * El rastro de una impersonación (Tarea 17) se rellena AQUÍ, no en cada caso
 * de uso: si `TenantContext.impersonationId()` dice que la petición ocurre
 * dentro de una, `actorKind` pasa a `"impersonation"` e
 * `impersonatorMembershipId` se fija a la membresía real de quien impersona
 * —o queda en blanco si es soporte de la plataforma sin membresía en esa
 * escuela—, sin importar qué haya pasado quien llamó a `record()`. Es la
 * única forma de que «toda acción registra los dos» (brief de la tarea) sea
 * cierto para CUALQUIER auditoría existente o futura — `update-student`,
 * `grant-consent`, la que sea — sin tener que enseñarle a cada una qué es
 * una impersonación.
 *
 * Los dos comandos de la propia impersonación (`StartImpersonationHandler`,
 * `EndImpersonationHandler`) pasan `actorKind`/`impersonatorMembershipId` a
 * mano porque escriben ANTES de que exista el contexto de tenant que lo
 * detectaría solo (arrancan sin haber fijado CLS todavía). Por eso se
 * distingue explícitamente «no lo pasó» (`undefined`, se autodetecta) de
 * «lo pasó y vale `null`» (soporte sin membresía: se respeta el `null`, no
 * se sustituye por lo que diga el tenant).
 */
@Injectable()
export class DrizzleAuditLogRepository implements AuditLogPort {
  constructor(
    private readonly drizzle: DrizzleService,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  async record(entry: AuditLogEntry): Promise<void> {
    const impersonating = entry.actorKind === "impersonation" || Boolean(this.tenant.impersonationId?.());

    const impersonatorMembershipId =
      entry.impersonatorMembershipId !== undefined
        ? entry.impersonatorMembershipId
        : impersonating
          ? (this.tenant.impersonatorMembershipId?.() ?? null)
          : null;

    const actorKind = impersonating ? "impersonation" : entry.actorKind;

    await this.drizzle.db.insert(schema.auditLogs).values({
      schoolId: entry.schoolId,
      actorKind,
      actorMembershipId: entry.actorMembershipId ?? null,
      impersonatorMembershipId,
      mcpClientId: entry.mcpClientId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
    });
  }
}
