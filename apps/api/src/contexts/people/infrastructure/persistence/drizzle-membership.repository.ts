import { Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { ProvisionedRole } from "../../domain/ports/membership-provisioning.port.js";
import type { MembershipRepository } from "./membership.repository.js";

/**
 * Implementación sobre Drizzle. Ninguna consulta filtra `memberships` por
 * `school_id` a mano: lo hace RLS. `users` sí es una tabla global sin
 * política de escuela — es la única con datos de personas que la tiene.
 */
@Injectable()
export class DrizzleMembershipRepository implements MembershipRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async upsertUser(params: { email: string; name: string; locale: string }): Promise<string> {
    const existing = await this.drizzle.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(sql`lower(${schema.users.email}) = lower(${params.email})`)
      .limit(1);
    if (existing[0]) return existing[0].id;

    // Sin `.returning()`, a propósito. La política de `users` deja insertar
    // con `WITH CHECK (true)` —el alta ocurre antes de tener membresía—, pero
    // solo hace VISIBLE una fila cuando existe un `membership` para ella
    // (`EXISTS (SELECT ... FROM memberships ...)`). `RETURNING` reevalúa esa
    // visibilidad sobre la fila recién insertada, así que sobre el rol
    // `langopia_app` —sin BYPASSRLS— pedir de vuelta el id con `.returning()`
    // choca con exactamente el hueco que la propia política documenta: el
    // usuario nuevo TODAVÍA no tiene membresía. El id se genera aquí, en vez
    // de leerlo de vuelta, porque ya se conoce antes de insertarlo.
    const id = randomUUID();
    await this.drizzle.db.insert(schema.users).values({
      id,
      email: params.email,
      name: params.name,
      locale: params.locale,
    });
    return id;
  }

  async upsertMembership(params: {
    schoolId: string;
    userId: string;
    role: ProvisionedRole;
    locale: string | null;
  }): Promise<string> {
    const existing = await this.drizzle.db
      .select({ id: schema.memberships.id })
      .from(schema.memberships)
      .where(
        and(
          eq(schema.memberships.schoolId, params.schoolId),
          eq(schema.memberships.userId, params.userId),
          eq(schema.memberships.role, params.role),
        ),
      )
      .limit(1);
    if (existing[0]) return existing[0].id;

    const [created] = await this.drizzle.db
      .insert(schema.memberships)
      .values({
        schoolId: params.schoolId,
        userId: params.userId,
        role: params.role,
        locale: params.locale,
      })
      .returning({ id: schema.memberships.id });
    return created!.id;
  }
}
