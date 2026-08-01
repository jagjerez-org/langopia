import { Injectable } from "@nestjs/common";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import * as schema from "@langopia/db/schema";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type {
  ActiveMcpAuthorization,
  McpOAuthRepository,
  RegisteredMcpClient,
} from "../mcp/oauth-server.js";

@Injectable()
export class DrizzleMcpOAuthRepository implements McpOAuthRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async createClient(input: Parameters<McpOAuthRepository["createClient"]>[0]) {
    const [row] = await this.drizzle.db
      .insert(schema.mcpClients)
      .values({
        schoolId: input.schoolId,
        name: input.name,
        clientId: input.clientId,
        redirectUris: input.redirectUris,
        scopes: input.scopes,
        clientKind: input.clientKind,
        authorizedByMembershipId: input.authorizedByMembershipId,
      })
      .returning();
    return mapClient(row);
  }

  async findClientByClientId(clientId: string) {
    const [row] = await this.drizzle.db
      .select()
      .from(schema.mcpClients)
      .where(eq(schema.mcpClients.clientId, clientId))
      .limit(1);
    return row ? mapClient(row) : null;
  }

  async createAuthorization(input: Parameters<McpOAuthRepository["createAuthorization"]>[0]) {
    const [row] = await this.drizzle.db
      .insert(schema.mcpAuthorizations)
      .values({
        id: input.id,
        schoolId: input.schoolId,
        mcpClientId: input.mcpClientId,
        membershipId: input.membershipId,
        scopes: input.scopes,
        accessTokenHash: input.accessTokenHash,
        expiresAt: input.expiresAt,
      })
      .returning();
    return mapAuthorization(row);
  }

  async findActiveAuthorizationByTokenHash(accessTokenHash: string, now: Date) {
    const [row] = await this.drizzle.db
      .select({
        authorization: schema.mcpAuthorizations,
        role: schema.memberships.role,
      })
      .from(schema.mcpAuthorizations)
      .innerJoin(schema.memberships, eq(schema.memberships.id, schema.mcpAuthorizations.membershipId))
      .where(
        and(
          eq(schema.mcpAuthorizations.accessTokenHash, accessTokenHash),
          isNull(schema.mcpAuthorizations.revokedAt),
          gt(schema.mcpAuthorizations.expiresAt, now),
        ),
      )
      .limit(1);
    return row ? mapAuthorization(row.authorization, [row.role]) : null;
  }

  async revokeAuthorization(authorizationId: string, membershipId: string) {
    const [row] = await this.drizzle.db
      .update(schema.mcpAuthorizations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.mcpAuthorizations.id, authorizationId),
          eq(schema.mcpAuthorizations.membershipId, membershipId),
          isNull(schema.mcpAuthorizations.revokedAt),
        ),
      )
      .returning({ id: schema.mcpAuthorizations.id });
    return Boolean(row);
  }

  async listAuthorizations(schoolId: string, now: Date) {
    const rows = await this.drizzle.db.execute<{
      authorization_id: string;
      client_name: string;
      client_kind: string;
      member_name: string;
      scopes: string[];
      status: "active" | "expired" | "revoked";
      created_at: Date;
      expires_at: Date;
      last_used_at: Date | null;
    }>(sql`
      SELECT
        a.id AS authorization_id,
        c.name AS client_name,
        c.client_kind,
        u.name AS member_name,
        a.scopes,
        CASE
          WHEN a.revoked_at IS NOT NULL THEN 'revoked'
          WHEN a.expires_at <= ${now.toISOString()}::timestamptz THEN 'expired'
          ELSE 'active'
        END AS status,
        a.created_at,
        a.expires_at,
        a.last_used_at
      FROM mcp_authorizations a
      JOIN mcp_clients c ON c.id = a.mcp_client_id
      JOIN memberships m ON m.id = a.membership_id
      JOIN users u ON u.id = m.user_id
      WHERE a.school_id = ${schoolId}::uuid
      ORDER BY a.created_at DESC
    `);

    return rows.map((row) => ({
      authorizationId: row.authorization_id,
      clientName: row.client_name,
      clientKind: row.client_kind,
      memberName: row.member_name,
      scopes: row.scopes,
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      lastUsedAt: row.last_used_at,
    }));
  }

  async revokeSchoolAuthorization(schoolId: string, authorizationId: string) {
    const [row] = await this.drizzle.db
      .update(schema.mcpAuthorizations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.mcpAuthorizations.id, authorizationId),
          eq(schema.mcpAuthorizations.schoolId, schoolId),
          isNull(schema.mcpAuthorizations.revokedAt),
        ),
      )
      .returning({ id: schema.mcpAuthorizations.id });
    return Boolean(row);
  }
}

type McpClientRow = typeof schema.mcpClients.$inferSelect;
type McpAuthorizationRow = typeof schema.mcpAuthorizations.$inferSelect;

function mapClient(row: McpClientRow | undefined): RegisteredMcpClient {
  if (!row) throw new Error("mcp_clients devolvió cero filas tras insertar.");
  return {
    id: row.id,
    clientId: row.clientId,
    schoolId: row.schoolId,
    name: row.name,
    redirectUris: row.redirectUris,
    scopes: row.scopes,
    revokedAt: row.revokedAt,
  };
}

function mapAuthorization(row: McpAuthorizationRow | undefined, roles: string[] = []): ActiveMcpAuthorization {
  if (!row) throw new Error("mcp_authorizations devolvió cero filas tras insertar.");
  return {
    id: row.id,
    schoolId: row.schoolId,
    mcpClientId: row.mcpClientId,
    membershipId: row.membershipId,
    roles,
    scopes: row.scopes,
    accessTokenHash: row.accessTokenHash,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  };
}
