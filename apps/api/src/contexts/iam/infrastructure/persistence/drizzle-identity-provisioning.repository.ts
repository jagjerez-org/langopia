import { Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { IdentityProvisioningPort } from "../../domain/ports/identity-provisioning.port.js";

@Injectable()
export class DrizzleIdentityProvisioningRepository implements IdentityProvisioningPort {
  constructor(private readonly drizzle: DrizzleService) {}

  /**
   * Fuera de cualquier tenant, a propósito: ver `IdentityProvisioningPort`.
   * Usa `.connection`, como `DrizzleMembershipLookupRepository`: es una
   * lectura que decide, no una que opera dentro de la escuela ya fijada.
   */
  async findUserIdByAuthUserId(authUserId: string): Promise<string | null> {
    const rows = await this.drizzle.connection.execute<{ id: string | null }>(
      sql`SELECT user_id_for_auth_user_id(${authUserId}) AS id`,
    );
    return rows[0]?.id ?? null;
  }

  async createUser(props: {
    id: string;
    authUserId: string;
    email: string;
    name: string;
    emailVerifiedAt: Date | null;
  }): Promise<void> {
    await this.drizzle.db.insert(schema.users).values({
      id: props.id,
      authUserId: props.authUserId,
      email: props.email,
      name: props.name,
      emailVerifiedAt: props.emailVerifiedAt,
    });
  }

  async addMembership(props: {
    id: string;
    schoolId: string;
    userId: string;
    role: string;
  }): Promise<void> {
    await this.drizzle.db.insert(schema.memberships).values({
      id: props.id,
      schoolId: props.schoolId,
      userId: props.userId,
      role: props.role as (typeof schema.membershipRole.enumValues)[number],
    });
  }
}
