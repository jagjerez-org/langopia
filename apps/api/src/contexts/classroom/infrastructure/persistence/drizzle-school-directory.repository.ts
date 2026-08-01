import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { SchoolDirectoryPort } from "../../domain/ports/school-directory.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";

/**
 * Única consulta de `classroom` que corre FUERA de una unidad de trabajo con
 * tenant fijado —ver `SchoolDirectoryPort` para la justificación— y no se
 * reutiliza para nada más.
 *
 * Usa `school_ids_for_system_jobs()`, una función `SECURITY DEFINER`
 * declarada en `packages/db/src/policies.sql` que devuelve solo el
 * identificador de cada escuela. La conexión sigue siendo la del rol
 * `langopia_app`, sin `BYPASSRLS`: lo único que gana es poder preguntar
 * «¿qué escuelas existen?», igual que `memberships_for_auth_user` solo deja
 * preguntar «¿a qué escuelas pertenece este correo?».
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
