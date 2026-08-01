import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { GroupRosterMember } from "@langopia/contracts";
import {
  SCHEDULING_READ_MODEL,
  type SchedulingReadModel,
} from "../../ports/scheduling-read-model.port.js";

export class GetGroupRosterQuery extends Query<GroupRosterMember[]> {
  constructor(readonly props: { groupId: string }) {
    super();
  }
}

/**
 * Padrón de un grupo, con nombre — lo que el calendario necesita para pintar
 * la hoja de asistencia (Tarea 9 del panel, Paso 6). Consulta directa al
 * modelo de lectura, sin pasar por el dominio: igual que
 * `GetWeeklyAgendaHandler`, fino a propósito.
 */
@QueryHandler(GetGroupRosterQuery)
export class GetGroupRosterHandler implements IQueryHandler<GetGroupRosterQuery> {
  constructor(
    @Inject(SCHEDULING_READ_MODEL) private readonly readModel: SchedulingReadModel,
  ) {}

  async execute(query: GetGroupRosterQuery): Promise<GroupRosterMember[]> {
    return this.readModel.rosterForGroup(query.props.groupId);
  }
}
