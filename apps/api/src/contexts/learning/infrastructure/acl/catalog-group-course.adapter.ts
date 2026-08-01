import { Injectable } from "@nestjs/common";
import type { GroupCourse, GroupCoursePort } from "../../domain/ports/group-course.port.js";
import { DrizzleGroupCourseRepository } from "../persistence/drizzle-group-course.repository.js";

/**
 * Capa anticorrupción hacia el contexto de Catálogo.
 *
 * `learning` solo necesita saber de qué curso —y de qué nivel— es cada grupo
 * al que se quiere publicar una unidad. Nada más de `catalog` cruza esta
 * frontera: ni el agregado `Group`, ni precios, ni matrículas.
 */
@Injectable()
export class CatalogGroupCourseAdapter implements GroupCoursePort {
  constructor(private readonly repository: DrizzleGroupCourseRepository) {}

  coursesOfGroups(groupIds: readonly string[]): Promise<GroupCourse[]> {
    return this.repository.coursesOfGroups(groupIds);
  }
}
