import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { NotFoundError } from "../../../shared/domain/errors/domain-error.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type {
  CatalogReadModel,
  CourseGroupSummary,
  CourseListItem,
  CourseTranslationItem,
  GroupDetail,
} from "../../application/ports/catalog-read-model.port.js";

/**
 * Lado de lectura. Igual que `DrizzlePeopleReadModel` y
 * `DrizzleSchedulingReadModel`: SQL a mano, cruza tablas de varios contextos
 * (`teacher_profiles`, `memberships`, `users`) y devuelve estructuras planas.
 * El aislamiento sigue garantizado por RLS, siempre que la consulta corra
 * dentro de `uow.read(...)` — sin eso, `schools`-y-companía se resuelven
 * sobre la conexión suelta y dejan de estar filtrados por escuela (ver la
 * nota larga en `GetSchoolTimezoneHandler`, de `scheduling`).
 */
@Injectable()
export class DrizzleCatalogReadModel implements CatalogReadModel {
  constructor(
    private readonly drizzle: DrizzleService,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async listCourses(): Promise<CourseListItem[]> {
    return this.uow.read(async () => this.coursesQuery());
  }

  private async coursesQuery(): Promise<CourseListItem[]> {
    const courseRows = await this.drizzle.db.execute<{
      course_id: string;
      code: string;
      language: string;
      level: string;
      modality: string;
      total_sessions: number;
      session_minutes: number;
      max_students: number;
      price_cents: number;
      currency: string;
      is_active: boolean;
    }>(sql`
      SELECT
        c.id                  AS course_id,
        c.code                AS code,
        c.language            AS language,
        c.level::text         AS level,
        c.modality::text      AS modality,
        c.total_sessions      AS total_sessions,
        c.session_minutes     AS session_minutes,
        c.max_students        AS max_students,
        c.price_cents         AS price_cents,
        c.currency            AS currency,
        c.is_active           AS is_active
      FROM courses c
      ORDER BY c.code
    `);

    const translationsByCourse = await this.translationsByCourse();
    const groupsByCourse = await this.groupsByCourse();

    return courseRows.map((r) => ({
      courseId: r.course_id,
      code: r.code,
      language: r.language,
      level: r.level,
      modality: r.modality,
      totalSessions: r.total_sessions,
      sessionMinutes: r.session_minutes,
      maxStudents: r.max_students,
      priceCents: r.price_cents,
      currency: r.currency,
      isActive: r.is_active,
      translations: translationsByCourse.get(r.course_id) ?? [],
      groups: groupsByCourse.get(r.course_id) ?? [],
    }));
  }

  private async translationsByCourse(): Promise<Map<string, CourseTranslationItem[]>> {
    const rows = await this.drizzle.db.execute<{
      course_id: string;
      locale: string;
      name: string;
      description: string | null;
    }>(sql`SELECT course_id, locale, name, description FROM course_translations`);

    const byCourse = new Map<string, CourseTranslationItem[]>();
    for (const row of rows) {
      const list = byCourse.get(row.course_id) ?? [];
      list.push({ locale: row.locale, name: row.name, description: row.description });
      byCourse.set(row.course_id, list);
    }
    return byCourse;
  }

  private async groupsByCourse(): Promise<Map<string, CourseGroupSummary[]>> {
    const rows = await this.drizzle.db.execute<{
      group_id: string;
      course_id: string;
      name: string;
      teacher_id: string | null;
      teacher_name: string | null;
      capacity: number;
      starts_on: string;
      ends_on: string | null;
      status: string;
    }>(sql`
      SELECT
        g.id                  AS group_id,
        g.course_id           AS course_id,
        g.name                AS name,
        tp.id                 AS teacher_id,
        tu.name               AS teacher_name,
        g.capacity            AS capacity,
        g.starts_on::text     AS starts_on,
        g.ends_on::text       AS ends_on,
        g.status::text        AS status
      FROM groups g
      LEFT JOIN teacher_profiles tp ON tp.id = g.teacher_profile_id
      LEFT JOIN memberships m       ON m.id = tp.membership_id
      LEFT JOIN users tu            ON tu.id = m.user_id
      ORDER BY g.starts_on DESC
    `);

    const byCourse = new Map<string, CourseGroupSummary[]>();
    for (const row of rows) {
      const list = byCourse.get(row.course_id) ?? [];
      list.push({
        groupId: row.group_id,
        name: row.name,
        teacherId: row.teacher_id,
        teacherName: row.teacher_name,
        capacity: row.capacity,
        startsOn: row.starts_on,
        endsOn: row.ends_on,
        status: row.status,
      });
      byCourse.set(row.course_id, list);
    }
    return byCourse;
  }

  async getGroupOrFail(groupId: string): Promise<GroupDetail> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db.execute<{
        group_id: string;
        course_id: string;
        course_code: string;
        course_language: string;
        course_level: string;
        teacher_id: string | null;
        teacher_name: string | null;
        name: string;
        capacity: number;
        starts_on: string;
        ends_on: string | null;
        status: string;
      }>(sql`
        SELECT
          g.id                  AS group_id,
          c.id                  AS course_id,
          c.code                AS course_code,
          c.language            AS course_language,
          c.level::text         AS course_level,
          tp.id                 AS teacher_id,
          tu.name               AS teacher_name,
          g.name                AS name,
          g.capacity            AS capacity,
          g.starts_on::text     AS starts_on,
          g.ends_on::text       AS ends_on,
          g.status::text        AS status
        FROM groups g
        JOIN courses c ON c.id = g.course_id
        LEFT JOIN teacher_profiles tp ON tp.id = g.teacher_profile_id
        LEFT JOIN memberships m       ON m.id = tp.membership_id
        LEFT JOIN users tu            ON tu.id = m.user_id
        WHERE g.id = ${groupId}
        LIMIT 1
      `);

      const row = rows[0];
      if (!row) throw new NotFoundError("el grupo", groupId);

      const translationRows = await this.drizzle.db.execute<{
        locale: string;
        name: string;
        description: string | null;
      }>(sql`SELECT locale, name, description FROM course_translations WHERE course_id = ${row.course_id}`);

      return {
        groupId: row.group_id,
        courseId: row.course_id,
        courseCode: row.course_code,
        courseLanguage: row.course_language,
        courseLevel: row.course_level,
        courseTranslations: translationRows.map((t) => ({
          locale: t.locale,
          name: t.name,
          description: t.description,
        })),
        teacherId: row.teacher_id,
        teacherName: row.teacher_name,
        name: row.name,
        capacity: row.capacity,
        startsOn: row.starts_on,
        endsOn: row.ends_on,
        status: row.status,
      };
    });
  }
}
