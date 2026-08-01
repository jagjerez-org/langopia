import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import {
  PEOPLE_READ_MODEL,
  type PeopleReadModel,
  type StudentListItem,
} from "../../ports/people-read-model.port.js";

export class ListStudentsQuery extends Query<StudentListItem[]> {}

/**
 * Consulta directa al modelo de lectura, sin pasar por el dominio. Igual que
 * `GetWeeklyAgendaHandler`: fino a propósito, sin lógica de negocio.
 */
@QueryHandler(ListStudentsQuery)
export class ListStudentsHandler implements IQueryHandler<ListStudentsQuery> {
  constructor(@Inject(PEOPLE_READ_MODEL) private readonly readModel: PeopleReadModel) {}

  async execute(): Promise<StudentListItem[]> {
    return this.readModel.listStudents();
  }
}
