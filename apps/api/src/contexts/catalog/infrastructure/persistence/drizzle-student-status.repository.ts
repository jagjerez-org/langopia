import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { StudentId } from "../../domain/model/identifiers.js";

/**
 * Acceso a datos del alumnado que necesita Catalog.
 *
 * Vive aquí, y no en `infrastructure/acl/`, porque el acceso a datos vive en
 * un repositorio (`ARCHITECTURE.md`): `PeopleStudentStatusAdapter` delega en
 * esta clase en lugar de escribir SQL él mismo.
 */
@Injectable()
export class DrizzleStudentStatusRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async isActive(studentId: StudentId): Promise<boolean> {
    const rows = await this.drizzle.db.execute<{ ok: boolean }>(sql`
      SELECT true AS ok
      FROM student_profiles sp
      WHERE sp.id = ${studentId.value} AND sp.status = 'active'
      LIMIT 1
    `);
    return rows.length > 0;
  }
}
