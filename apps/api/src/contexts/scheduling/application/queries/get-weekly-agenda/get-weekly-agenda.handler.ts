import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import {
  SCHEDULING_READ_MODEL,
  type AgendaEntry,
  type SchedulingReadModel,
} from "../../ports/scheduling-read-model.port.js";

export class GetWeeklyAgendaQuery extends Query<AgendaEntry[]> {
  constructor(
    readonly props: {
      from: string;
      to: string;
      teacherId?: string;
      groupId?: string;
    },
  ) {
    super();
  }
}

/**
 * Consulta directa al modelo de lectura, sin pasar por el dominio.
 *
 * El manejador es fino a propósito: si algún día tiene lógica, esa lógica es
 * de presentación (agrupar por día, rellenar huecos), nunca de negocio.
 */
@QueryHandler(GetWeeklyAgendaQuery)
export class GetWeeklyAgendaHandler implements IQueryHandler<GetWeeklyAgendaQuery> {
  constructor(
    @Inject(SCHEDULING_READ_MODEL) private readonly readModel: SchedulingReadModel,
  ) {}

  async execute(query: GetWeeklyAgendaQuery): Promise<AgendaEntry[]> {
    return this.readModel.agendaBetween({
      from: new Date(query.props.from),
      to: new Date(query.props.to),
      teacherId: query.props.teacherId,
      groupId: query.props.groupId,
    });
  }
}
