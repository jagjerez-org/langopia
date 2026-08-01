import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import {
  LEARNING_READ_MODEL,
  type GenerationEstimate,
  type LearningReadModel,
} from "../../ports/learning-read-model.port.js";

export class GetGenerationEstimateQuery extends Query<GenerationEstimate> {}

/**
 * Coste estimado y saldo ANTES de generar (Tarea 11 del panel, Pasos 1 y 5):
 * «los créditos son dinero, eso debe entenderse antes de intentarlo, no como
 * un error críptico después». `wouldBeRejected` es la misma comparación que
 * hace `CreditBalance.spend()` con `ai_hard_limit` — el panel la muestra,
 * nunca la recalcula.
 */
@QueryHandler(GetGenerationEstimateQuery)
export class GetGenerationEstimateHandler implements IQueryHandler<GetGenerationEstimateQuery> {
  constructor(@Inject(LEARNING_READ_MODEL) private readonly readModel: LearningReadModel) {}

  async execute(_query?: GetGenerationEstimateQuery): Promise<GenerationEstimate> {
    return this.readModel.getGenerationEstimate();
  }
}
