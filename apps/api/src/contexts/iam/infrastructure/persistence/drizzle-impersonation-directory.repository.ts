import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type {
  ActiveImpersonationRow,
  ImpersonationDirectoryPort,
} from "../../domain/ports/impersonation-directory.port.js";

/**
 * Fuera de cualquier tenant, a propósito — igual que
 * `DrizzleMembershipLookupRepository` y por el mismo motivo: estas preguntas
 * son las que deciden QUÉ tenant hay que fijar (o si hace falta fijar el de
 * la persona impersonada en vez del propio), así que no pueden depender de
 * que ya exista uno. Usa `.connection`, no `.db`, y las cuatro se apoyan en
 * funciones `SECURITY DEFINER` de `policies.sql`.
 */
@Injectable()
export class DrizzleImpersonationDirectoryRepository implements ImpersonationDirectoryPort {
  constructor(private readonly drizzle: DrizzleService) {}

  async isPlatformSupport(authUserId: string): Promise<boolean> {
    const rows = await this.drizzle.connection.execute<{ isPlatformSupport: boolean }>(
      sql`SELECT is_platform_support(${authUserId}) AS "isPlatformSupport"`,
    );
    return rows[0]?.isPlatformSupport ?? false;
  }

  async schoolIdForMembership(membershipId: string): Promise<string | null> {
    const rows = await this.drizzle.connection.execute<{ schoolId: string | null }>(
      sql`SELECT school_id_for_membership(${membershipId}) AS "schoolId"`,
    );
    return rows[0]?.schoolId ?? null;
  }

  async activeAsImpersonator(authUserId: string): Promise<ActiveImpersonationRow | null> {
    const rows = await this.drizzle.connection.execute<{
      impersonationId: string;
      schoolId: string;
      targetMembershipId: string;
      targetRole: string;
      targetSchoolLocale: string | null;
      targetSchoolSlug: string;
      targetSchoolStatus: string;
      impersonatorMembershipId: string | null;
      reason: string;
      involvesMinor: boolean;
      expiresAt: Date;
    }>(sql`
      SELECT "impersonationId", "schoolId", "targetMembershipId", "targetRole", "targetSchoolLocale",
             "targetSchoolSlug", "targetSchoolStatus",
             "impersonatorMembershipId", "reason", "involvesMinor", "expiresAt"
      FROM active_impersonation_for_impersonator(${authUserId})
    `);
    const row = rows[0];
    return row
      ? {
          impersonationId: row.impersonationId,
          schoolId: row.schoolId,
          targetMembershipId: row.targetMembershipId,
          targetRole: row.targetRole,
          targetSchoolLocale: row.targetSchoolLocale,
          targetSchoolSlug: row.targetSchoolSlug,
          targetSchoolStatus: row.targetSchoolStatus,
          impersonatorMembershipId: row.impersonatorMembershipId,
          reason: row.reason,
          involvesMinor: row.involvesMinor,
          expiresAt: new Date(row.expiresAt),
        }
      : null;
  }

  async isBeingImpersonated(authUserId: string): Promise<boolean> {
    const rows = await this.drizzle.connection.execute<{ isBeingImpersonated: boolean }>(
      sql`SELECT is_being_impersonated(${authUserId}) AS "isBeingImpersonated"`,
    );
    return rows[0]?.isBeingImpersonated ?? false;
  }
}
