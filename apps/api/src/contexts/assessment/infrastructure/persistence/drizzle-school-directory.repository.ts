import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { SchoolDirectoryPort } from "../../domain/ports/school-directory.port.js";

/**
 * Única consulta de `assessment` que corre FUERA de una unidad de trabajo con
 * tenant fijado —ver `SchoolDirectoryPort` para la justificación— y no se
 * reutiliza para nada más.
 *
 * Usa `school_ids_for_system_jobs()`, la misma función `SECURITY DEFINER` de
 * `packages/db/src/policies.sql` que ya usan `classroom` y `notifications`
 * para lo mismo.
 */
@Injectable()
export class DrizzleSchoolDirectoryRepository implements SchoolDirectoryPort {
  constructor(private readonly drizzle: DrizzleService) {}

  async allIds(): Promise<string[]> {
    const rows = await this.drizzle.connection.execute<{ id: string }>(
      sql`SELECT id FROM school_ids_for_system_jobs()`,
    );
    return [...rows].map((row) => row.id);
  }
}
