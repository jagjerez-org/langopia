import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import {
  CATALOG_READ_MODEL,
  type CatalogReadModel,
  type CourseListItem,
} from "../../ports/catalog-read-model.port.js";

export class ListCoursesQuery extends Query<CourseListItem[]> {}

/**
 * Consulta directa al modelo de lectura, sin pasar por el dominio. Igual que
 * `ListStudentsHandler` (`people`): fino a propósito, sin lógica de negocio.
 */
@QueryHandler(ListCoursesQuery)
export class ListCoursesHandler implements IQueryHandler<ListCoursesQuery> {
  constructor(@Inject(CATALOG_READ_MODEL) private readonly readModel: CatalogReadModel) {}

  async execute(): Promise<CourseListItem[]> {
    return this.readModel.listCourses();
  }
}
