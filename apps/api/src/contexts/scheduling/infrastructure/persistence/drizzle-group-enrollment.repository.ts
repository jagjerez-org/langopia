import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import { GroupId, StudentId } from "../../domain/model/identifiers.js";

/**
 * Acceso a datos de matrícula que necesita Scheduling.
 *
 * Vive aquí, y no en `infrastructure/acl/`, porque el acceso a datos vive en
 * un repositorio (`ARCHITECTURE.md`): `CatalogGroupEnrollmentAdapter` delega
 * en esta clase en lugar de escribir SQL él mismo. La tabla `enrollments` es
 * de `catalog`; esto NO es un cruce de dominio —no se importa nada de
 * `contexts/catalog/`—, es SQL crudo contra el esquema compartido, igual que
 * `DrizzleTeacherAvailabilityRepository` consulta `teacher_profiles` de
 * `people`.
 */
@Injectable()
export class DrizzleGroupEnrollmentRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async activeStudentIds(groupId: GroupId): Promise<StudentId[]> {
    const rows = await this.drizzle.db.execute<{ student_profile_id: string }>(sql`
      SELECT student_profile_id
      FROM enrollments
      WHERE group_id = ${groupId.value} AND status = 'active'
    `);
    return rows.map((r) => StudentId.of(r.student_profile_id));
  }
}
