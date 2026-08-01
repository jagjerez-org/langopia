import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import {
  LEARNING_READ_MODEL,
  type ContentUnitListItem,
  type LearningReadModel,
} from "../../ports/learning-read-model.port.js";

export class ListUnitsQuery extends Query<ContentUnitListItem[]> {
  constructor(readonly props: { status?: string }) {
    super();
  }
}

/**
 * Listado de unidades didácticas de la escuela activa (Tarea 11 del panel),
 * opcionalmente filtrado por estado — para encontrar las que están
 * `in_review` esperando revisión. Puro paso a través del modelo de lectura,
 * igual que `ListInvoicesHandler` (`billing`): el filtro es un `WHERE`, no
 * una regla.
 */
@QueryHandler(ListUnitsQuery)
export class ListUnitsHandler implements IQueryHandler<ListUnitsQuery> {
  constructor(@Inject(LEARNING_READ_MODEL) private readonly readModel: LearningReadModel) {}

  async execute(query: ListUnitsQuery): Promise<ContentUnitListItem[]> {
    return this.readModel.listUnits({ status: query.props.status });
  }
}
