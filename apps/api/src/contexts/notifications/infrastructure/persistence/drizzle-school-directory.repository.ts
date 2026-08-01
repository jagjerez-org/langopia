import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { SchoolDirectoryPort } from "../../domain/ports/school-directory.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";

/**
 * Única consulta de `notifications` que corre FUERA de una unidad de trabajo
 * con tenant fijado —igual que su análoga en `classroom`, ver
 * `SchoolDirectoryPort` para la justificación completa— y no se reutiliza
 * para nada más que arrancar el trabajo programado del recordatorio de clase.
 *
 * Usa la misma función `SECURITY DEFINER` que ya declaró la purga RGPD de
 * `classroom` (`school_ids_for_system_jobs()`, en `packages/db/src/policies.sql`):
 * no hace falta una segunda.
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
