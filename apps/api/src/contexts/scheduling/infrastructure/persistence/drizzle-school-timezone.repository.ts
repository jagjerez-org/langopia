import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";

/**
 * Configuración de la escuela que Scheduling necesita leer.
 *
 * Vive aquí, y no en `infrastructure/acl/`, porque el acceso a datos vive en
 * un repositorio (`ARCHITECTURE.md`): `SchoolSchedulingPolicyAdapter` delega
 * en esta clase en lugar de escribir SQL él mismo.
 */
@Injectable()
export class DrizzleSchoolTimezoneRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async timezone(): Promise<string | null> {
    // RLS deja visible una sola escuela, así que no hace falta filtrar por id.
    const rows = await this.drizzle.db.execute<{ timezone: string }>(
      sql`SELECT timezone FROM schools LIMIT 1`,
    );
    return rows[0]?.timezone ?? null;
  }
}
