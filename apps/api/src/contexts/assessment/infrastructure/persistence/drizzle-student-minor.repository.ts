import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { StudentId } from "../../domain/model/identifiers.js";

/**
 * Acceso a datos de `people` que necesita Assessment: si un alumno es menor
 * de edad. Vive aquí, y no en `infrastructure/acl/`, por el mismo motivo que
 * `DrizzleTeachesStudentRepository`: el acceso a datos vive en un
 * repositorio. `guardian_required` ya viene calculado por `people` sobre la
 * fecha de nacimiento — Assessment no repite ese cálculo.
 */
@Injectable()
export class DrizzleStudentMinorRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async isMinor(studentId: StudentId): Promise<boolean> {
    const rows = await this.drizzle.db.execute<{ guardian_required: boolean }>(sql`
      SELECT guardian_required
      FROM student_profiles
      WHERE id = ${studentId.value}
      LIMIT 1
    `);
    return rows[0]?.guardian_required ?? false;
  }

  /** Tarea 16: la propia ficha, o una fila de `guardians` que la ate a esta membresía. */
  async isSelfOrGuardian(params: { membershipId: string; studentId: StudentId }): Promise<boolean> {
    const rows = await this.drizzle.db.execute<{ ok: boolean }>(sql`
      SELECT true AS ok
      FROM student_profiles sp
      WHERE sp.id = ${params.studentId.value}
        AND (
          sp.membership_id = ${params.membershipId}
          OR EXISTS (
            SELECT 1 FROM guardians g
            WHERE g.student_profile_id = sp.id AND g.membership_id = ${params.membershipId}
          )
        )
      LIMIT 1
    `);
    return rows.length > 0;
  }

  /** Tarea 16: existe EN LA ESCUELA ACTIVA — RLS ya oculta cualquier otra. */
  async exists(studentId: StudentId): Promise<boolean> {
    const rows = await this.drizzle.db.execute<{ ok: boolean }>(sql`
      SELECT true AS ok FROM student_profiles WHERE id = ${studentId.value} LIMIT 1
    `);
    return rows.length > 0;
  }
}
