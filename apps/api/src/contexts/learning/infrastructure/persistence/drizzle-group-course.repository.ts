import { Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { eq, inArray } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { GroupCourse } from "../../domain/ports/group-course.port.js";

/**
 * Acceso a datos de `catalog` que necesita `learning` al publicar a grupos:
 * de qué curso es cada grupo y de qué nivel es ese curso.
 *
 * Vive en un repositorio, y el adaptador (`CatalogGroupCourseAdapter`) solo
 * delega — mismo reparto que `DrizzleStudentSelfRepository` /
 * `PeopleStudentSelfAdapter`. Sin filtrar por `school_id`: lo hace RLS.
 */
@Injectable()
export class DrizzleGroupCourseRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async coursesOfGroups(groupIds: readonly string[]): Promise<GroupCourse[]> {
    if (groupIds.length === 0) return [];

    const rows = await this.drizzle.db
      .select({
        groupId: schema.groups.id,
        courseId: schema.groups.courseId,
        level: schema.courses.level,
      })
      .from(schema.groups)
      .innerJoin(schema.courses, eq(schema.courses.id, schema.groups.courseId))
      .where(inArray(schema.groups.id, [...groupIds]));

    return rows.map((row) => ({ groupId: row.groupId, courseId: row.courseId, level: row.level }));
  }
}
