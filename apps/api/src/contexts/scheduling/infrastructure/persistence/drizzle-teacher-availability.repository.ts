import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { TeacherId } from "../../domain/model/identifiers.js";
import type { TimeSlot } from "../../domain/model/time-slot.vo.js";

/**
 * Acceso a datos del profesorado que necesita Scheduling.
 *
 * Vive aquí, y no en `infrastructure/acl/`, porque el acceso a datos vive en
 * un repositorio (`ARCHITECTURE.md`): `PeopleTeacherAvailabilityAdapter`
 * delega en esta clase en lugar de escribir SQL él mismo.
 *
 * NOTA sobre la disponibilidad: se guarda en minutos desde medianoche y en la
 * zona horaria de la ESCUELA, mientras que las clases se guardan en UTC. La
 * conversión se hace aquí, con `AT TIME ZONE`, y no en el dominio: qué hora
 * local es un instante UTC es un detalle de traducción, no una regla de
 * negocio.
 */
@Injectable()
export class DrizzleTeacherAvailabilityRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async isActive(teacherId: TeacherId): Promise<boolean> {
    const rows = await this.drizzle.db.execute<{ ok: boolean }>(sql`
      SELECT true AS ok
      FROM teacher_profiles tp
      WHERE tp.id = ${teacherId.value} AND tp.status = 'active'
      LIMIT 1
    `);
    return rows.length > 0;
  }

  async coversSlot(teacherId: TeacherId, slot: TimeSlot): Promise<boolean> {
    const rows = await this.drizzle.db.execute<{ ok: boolean }>(sql`
      WITH tz AS (
        SELECT sc.timezone
        FROM teacher_profiles tp
        JOIN schools sc ON sc.id = tp.school_id
        WHERE tp.id = ${teacherId.value}
      ),
      local AS (
        SELECT
          EXTRACT(ISODOW FROM (${slot.start.toISOString()}::timestamptz AT TIME ZONE tz.timezone))::int AS weekday,
          EXTRACT(HOUR   FROM (${slot.start.toISOString()}::timestamptz AT TIME ZONE tz.timezone))::int * 60
            + EXTRACT(MINUTE FROM (${slot.start.toISOString()}::timestamptz AT TIME ZONE tz.timezone))::int AS start_minute,
          EXTRACT(HOUR   FROM (${slot.end.toISOString()}::timestamptz AT TIME ZONE tz.timezone))::int * 60
            + EXTRACT(MINUTE FROM (${slot.end.toISOString()}::timestamptz AT TIME ZONE tz.timezone))::int AS end_minute
        FROM tz
      )
      SELECT true AS ok
      FROM teacher_availability ta, local
      WHERE ta.teacher_profile_id = ${teacherId.value}
        AND ta.weekday      = local.weekday
        AND ta.start_minute <= local.start_minute
        AND ta.end_minute   >= local.end_minute
      LIMIT 1
    `);
    return rows.length > 0;
  }

  async contractedHoursPerWeek(teacherId: TeacherId): Promise<number | null> {
    const rows = await this.drizzle.db.execute<{ hours: number }>(sql`
      SELECT contracted_hours_week::int AS hours
      FROM teacher_profiles
      WHERE id = ${teacherId.value}
      LIMIT 1
    `);
    return rows[0] ? Number(rows[0].hours) : null;
  }
}
