import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import {
  LEARNING_READ_MODEL,
  type ContentUnitDetail,
  type LearningReadModel,
} from "../../ports/learning-read-model.port.js";

export class GetUnitDetailQuery extends Query<ContentUnitDetail> {
  constructor(readonly props: { contentUnitId: string }) {
    super();
  }
}

/**
 * Ficha de una unidad (Tarea 11 del panel, Paso 3): título, cuerpo y sus
 * ejercicios con `prompt`/`solution` completos — lo que no devolvía
 * `POST /learning/units/generate` (solo `{contentUnitId, status}`) y
 * necesita la pantalla de revisión para pintar algo.
 */
@QueryHandler(GetUnitDetailQuery)
export class GetUnitDetailHandler implements IQueryHandler<GetUnitDetailQuery> {
  constructor(@Inject(LEARNING_READ_MODEL) private readonly readModel: LearningReadModel) {}

  async execute(query: GetUnitDetailQuery): Promise<ContentUnitDetail> {
    const detail = await this.readModel.getUnitDetail(query.props.contentUnitId);
    if (!detail) throw new NotFoundError("la unidad didáctica", query.props.contentUnitId);
    return detail;
  }
}
