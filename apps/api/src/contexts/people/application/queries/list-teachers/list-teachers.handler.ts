import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import {
  PEOPLE_READ_MODEL,
  type PeopleReadModel,
  type TeacherListItem,
} from "../../ports/people-read-model.port.js";

export class ListTeachersQuery extends Query<TeacherListItem[]> {}

/**
 * Consulta directa al modelo de lectura, sin pasar por el dominio. Igual que
 * `ListStudentsHandler`: fino a propósito, sin lógica de negocio.
 */
@QueryHandler(ListTeachersQuery)
export class ListTeachersHandler implements IQueryHandler<ListTeachersQuery> {
  constructor(@Inject(PEOPLE_READ_MODEL) private readonly readModel: PeopleReadModel) {}

  async execute(): Promise<TeacherListItem[]> {
    return this.readModel.listTeachers();
  }
}
