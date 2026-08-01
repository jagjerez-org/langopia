import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import {
  CATALOG_READ_MODEL,
  type CatalogReadModel,
  type GroupDetail,
} from "../../ports/catalog-read-model.port.js";

export class GetGroupQuery extends Query<GroupDetail> {
  constructor(readonly props: { groupId: string }) {
    super();
  }
}

/**
 * Ficha de un grupo (`/grupos/:id`, Tarea 8 del panel web, Paso 3). Consulta
 * directa al modelo de lectura: `getGroupOrFail` ya lanza `NotFoundError` si
 * el grupo no existe en esta escuela, así que este manejador no repite esa
 * comprobación.
 */
@QueryHandler(GetGroupQuery)
export class GetGroupHandler implements IQueryHandler<GetGroupQuery> {
  constructor(@Inject(CATALOG_READ_MODEL) private readonly readModel: CatalogReadModel) {}

  async execute(query: GetGroupQuery): Promise<GroupDetail> {
    return this.readModel.getGroupOrFail(query.props.groupId);
  }
}
