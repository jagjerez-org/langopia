import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import {
  LEARNING_READ_MODEL,
  type LearningReadModel,
  type PublishTarget,
} from "../../ports/learning-read-model.port.js";

export class GetPublishTargetsQuery extends Query<PublishTarget[]> {
  constructor(readonly props: { contentUnitId: string }) {
    super();
  }
}

/**
 * A qué grupos se puede publicar esta unidad (Tarea 11 del panel, Paso 4:
 * «publicar a grupos, con selector múltiple»).
 *
 * La elegibilidad de cada grupo la decide el modelo de lectura, no el panel:
 * si el cliente tuviera que comparar idioma y nivel para saber qué grupos
 * ofrecer, habría dos verdades sobre la misma regla y una acabaría
 * equivocándose (`OLA-1-WEB.md`).
 */
@QueryHandler(GetPublishTargetsQuery)
export class GetPublishTargetsHandler implements IQueryHandler<GetPublishTargetsQuery> {
  constructor(@Inject(LEARNING_READ_MODEL) private readonly readModel: LearningReadModel) {}

  async execute(query: GetPublishTargetsQuery): Promise<PublishTarget[]> {
    return this.readModel.listPublishTargets(query.props.contentUnitId);
  }
}
