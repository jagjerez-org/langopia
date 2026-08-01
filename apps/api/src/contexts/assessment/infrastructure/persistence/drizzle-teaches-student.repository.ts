import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { StudentId, TeacherId } from "../../domain/model/identifiers.js";

const DAY_MS = 24 * 3_600_000;

/**
 * Acceso a datos de `scheduling` que necesita Assessment: si un profesor
 * impartió clase a un alumno en un periodo. Vive aquí, y no en
 * `infrastructure/acl/`, porque el acceso a datos vive en un repositorio
 * (`ARCHITECTURE.md`): `SchedulingTeachesStudentAdapter` delega en esta clase
 * en lugar de escribir SQL él mismo. `sessions` y `attendance` son de
 * `scheduling`; esto NO es un cruce de dominio —no se importa nada de
 * `contexts/scheduling/`—, es SQL crudo contra el esquema compartido, igual
 * que `DrizzleGroupEnrollmentRepository` consulta `enrollments` de `catalog`.
 *
 * Que exista una fila de asistencia (con cualquier estado, presente o
 * ausente) es la prueba de que la clase ocurrió con ese alumno en la lista:
 * es más preciso que la matrícula, que no dice si la clase llegó a darse.
 */
@Injectable()
export class DrizzleTeachesStudentRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async taught(params: {
    teacherId: TeacherId;
    studentId: StudentId;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<boolean> {
    // `periodEnd` es una fecha sin hora: el límite superior se hace exclusivo
    // al día siguiente para no perder las clases del propio último día.
    const periodEndExclusive = new Date(params.periodEnd.getTime() + DAY_MS);

    const rows = await this.drizzle.db.execute<{ ok: boolean }>(sql`
      SELECT true AS ok
      FROM sessions s
      JOIN attendance a ON a.session_id = s.id
      WHERE s.teacher_profile_id = ${params.teacherId.value}
        AND a.student_profile_id = ${params.studentId.value}
        AND s.scheduled_start >= ${params.periodStart.toISOString()}::timestamptz
        AND s.scheduled_start <  ${periodEndExclusive.toISOString()}::timestamptz
      LIMIT 1
    `);
    return rows.length > 0;
  }

  /**
   * Tarea 16: sin acotar a un periodo (ver el puerto), y a partir de la
   * MEMBRESÍA que pregunta —se resuelve su `teacher_profiles.id` aquí mismo,
   * igual que el resto de esta clase resuelve hechos de `scheduling` sin que
   * `assessment` importe su repositorio—.
   */
  async teachesStudent(params: { membershipId: string; studentId: StudentId }): Promise<boolean> {
    const rows = await this.drizzle.db.execute<{ ok: boolean }>(sql`
      SELECT true AS ok
      FROM sessions s
      JOIN attendance a ON a.session_id = s.id
      JOIN teacher_profiles tp ON tp.id = s.teacher_profile_id
      WHERE tp.membership_id = ${params.membershipId}
        AND a.student_profile_id = ${params.studentId.value}
      LIMIT 1
    `);
    return rows.length > 0;
  }
}
