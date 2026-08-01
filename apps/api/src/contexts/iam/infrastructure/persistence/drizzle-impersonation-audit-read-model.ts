import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type {
  ImpersonationAuditReadModel,
  ImpersonationAuditRow,
} from "../../application/ports/impersonation-audit-read-model.port.js";

type Row = {
  impersonation_id: string;
  target_membership_id: string;
  target_name: string;
  target_role: string;
  impersonator_name: string;
  impersonator_email: string;
  reason: string;
  involves_minor: boolean;
  started_at: Date;
  ended_at: Date | null;
  expires_at: Date;
};

/**
 * Dentro de tenant: RLS aísla `impersonations` por `school_id`, así que esta
 * consulta solo puede devolver el rastro de la escuela activa.
 */
@Injectable()
export class DrizzleImpersonationAuditReadModel implements ImpersonationAuditReadModel {
  constructor(private readonly drizzle: DrizzleService) {}

  async listForSchool(limit: number): Promise<ImpersonationAuditRow[]> {
    const rows = await this.drizzle.db.execute<Row>(sql`
      SELECT
        i.id                       AS impersonation_id,
        i.target_membership_id     AS target_membership_id,
        u.name                     AS target_name,
        m.role::text               AS target_role,
        i.impersonator_name        AS impersonator_name,
        i.impersonator_email       AS impersonator_email,
        i.reason                   AS reason,
        i.involves_minor           AS involves_minor,
        i.started_at               AS started_at,
        i.ended_at                 AS ended_at,
        i.expires_at               AS expires_at
      FROM impersonations i
      JOIN memberships m ON m.id = i.target_membership_id
      JOIN users u       ON u.id = m.user_id
      ORDER BY i.started_at DESC
      LIMIT ${limit}
    `);

    return rows.map((row) => {
      // `db.execute(sql\`...\`)` no pasa por el mapeo de columnas de Drizzle:
      // el controlador `postgres` devuelve `timestamptz` como texto, no como
      // `Date`. Se convierte aquí, igual que ya hace
      // `DrizzleImpersonationDirectoryRepository` con `expiresAt`.
      const startedAt = new Date(row.started_at);
      const endedAt = row.ended_at ? new Date(row.ended_at) : null;
      const expiresAt = new Date(row.expires_at);
      const closedAt = endedAt ?? (expiresAt < new Date() ? expiresAt : null);
      return {
        impersonationId: row.impersonation_id,
        targetMembershipId: row.target_membership_id,
        targetName: row.target_name,
        targetRole: row.target_role,
        impersonatorName: row.impersonator_name,
        impersonatorEmail: row.impersonator_email,
        reason: row.reason,
        involvesMinor: row.involves_minor,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt ? endedAt.toISOString() : null,
        expiresAt: expiresAt.toISOString(),
        durationSeconds: closedAt ? Math.round((closedAt.getTime() - startedAt.getTime()) / 1000) : null,
      };
    });
  }
}
