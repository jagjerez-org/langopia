import { Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { eq, sql } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { Impersonation, ImpersonationId } from "../../domain/model/impersonation.aggregate.js";
import type {
  ImpersonationRepositoryPort,
  TargetMembershipInfo,
} from "../../domain/ports/impersonation-repository.port.js";
import { ImpersonationMapper } from "./impersonation.mapper.js";

/**
 * Dentro de tenant: se ejecuta con `app.school_id` ya fijado a la escuela de
 * la persona impersonada, así que RLS aísla exactamente igual que en
 * cualquier otro repositorio de `iam`.
 */
@Injectable()
export class DrizzleImpersonationRepository implements ImpersonationRepositoryPort {
  constructor(private readonly drizzle: DrizzleService) {}

  async save(impersonation: Impersonation): Promise<void> {
    const row = ImpersonationMapper.toPersistence(impersonation);
    await this.drizzle.db
      .insert(schema.impersonations)
      .values(row)
      .onConflictDoUpdate({
        target: schema.impersonations.id,
        set: { endedAt: row.endedAt },
      });
  }

  async findById(id: ImpersonationId): Promise<Impersonation | null> {
    const rows = await this.drizzle.db
      .select()
      .from(schema.impersonations)
      .where(eq(schema.impersonations.id, id.value))
      .limit(1);
    return rows[0] ? ImpersonationMapper.toDomain(rows[0]) : null;
  }

  async findTargetMembership(membershipId: string): Promise<TargetMembershipInfo | null> {
    const rows = await this.drizzle.db.execute<{
      role: string;
      user_id: string;
      auth_user_id: string | null;
      name: string;
    }>(sql`
      SELECT m.role::text AS role, m.user_id AS user_id, u.auth_user_id AS auth_user_id, u.name AS name
      FROM memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.id = ${membershipId}
    `);
    const row = rows[0];
    if (!row) return null;
    return {
      role: row.role as TargetMembershipInfo["role"],
      userId: row.user_id,
      authUserId: row.auth_user_id,
      name: row.name,
    };
  }
}
