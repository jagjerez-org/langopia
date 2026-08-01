import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import {
  ASSESSMENT_READ_MODEL,
  type AssessmentReadModel,
  type PendingAttemptEntry,
} from "../../ports/assessment-read-model.port.js";

/** Tope de la bandeja: una sesión de corrección abarcable, igual que `MAX_DUE_CARDS_PER_SESSION` de `learning`. */
export const MAX_PENDING_ATTEMPTS = 50;

export class GetPendingAttemptsQuery extends Query<PendingAttemptEntry[]> {}

/**
 * Bandeja del profesor (tarea 12 de la ola 2, paso 5): los intentos que
 * siguen esperando una firma, el más antiguo primero.
 *
 * Consulta directa al modelo de lectura, sin lógica de negocio propia —
 * igual que `GetStudentsWithoutEvaluationHandler`—: el filtro de estados y el
 * orden ya los decide `pendingValidation`.
 */
@QueryHandler(GetPendingAttemptsQuery)
export class GetPendingAttemptsHandler implements IQueryHandler<GetPendingAttemptsQuery> {
  constructor(@Inject(ASSESSMENT_READ_MODEL) private readonly readModel: AssessmentReadModel) {}

  async execute(): Promise<PendingAttemptEntry[]> {
    return this.readModel.pendingValidation({ limit: MAX_PENDING_ATTEMPTS });
  }
}
