import { Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { eq, sql } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { Invitation } from "../../domain/model/invitation.aggregate.js";
import type { InvitationRepositoryPort } from "../../domain/ports/invitation-repository.port.js";
import { InvitationMapper } from "./invitation.mapper.js";

@Injectable()
export class DrizzleInvitationRepository implements InvitationRepositoryPort {
  constructor(private readonly drizzle: DrizzleService) {}

  async findByToken(token: string): Promise<Invitation | null> {
    const rows = await this.drizzle.db
      .select()
      .from(schema.invitations)
      .where(eq(schema.invitations.token, token))
      .limit(1);
    return rows[0] ? InvitationMapper.toDomain(rows[0]) : null;
  }

  async save(invitation: Invitation): Promise<void> {
    const row = InvitationMapper.toPersistence(invitation);
    await this.drizzle.db
      .insert(schema.invitations)
      .values(row)
      .onConflictDoUpdate({
        target: schema.invitations.id,
        set: { acceptedAt: row.acceptedAt, revokedAt: row.revokedAt },
      });
  }

  /**
   * Fuera de cualquier tenant, a propósito: ver `InvitationRepositoryPort`.
   * Usa `.connection`, no `.db` — igual que `DrizzleMembershipLookupRepository`
   * y por el mismo motivo, esto averigua QUÉ tenant hay que fijar.
   */
  async schoolIdForToken(token: string): Promise<string | null> {
    const rows = await this.drizzle.connection.execute<{ schoolId: string | null }>(
      sql`SELECT school_id_for_invitation_token(${token}) AS "schoolId"`,
    );
    return rows[0]?.schoolId ?? null;
  }
}
