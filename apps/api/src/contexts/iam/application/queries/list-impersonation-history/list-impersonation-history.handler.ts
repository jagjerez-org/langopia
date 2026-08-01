import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import {
  IMPERSONATION_AUDIT_READ_MODEL,
  type ImpersonationAuditReadModel,
  type ImpersonationAuditRow,
} from "../../ports/impersonation-audit-read-model.port.js";

const DEFAULT_LIMIT = 100;

export class ListImpersonationHistoryQuery extends Query<ImpersonationAuditRow[]> {}

/**
 * Consulta directa al modelo de lectura, sin pasar por el dominio — igual
 * que `ListStudentsHandler`. RLS filtra por la escuela activa: una escuela
 * ve su propio rastro de impersonación, nunca el de otra.
 */
@QueryHandler(ListImpersonationHistoryQuery)
export class ListImpersonationHistoryHandler
  implements IQueryHandler<ListImpersonationHistoryQuery>
{
  constructor(
    @Inject(IMPERSONATION_AUDIT_READ_MODEL) private readonly readModel: ImpersonationAuditReadModel,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async execute(): Promise<ImpersonationAuditRow[]> {
    return this.uow.read(() => this.readModel.listForSchool(DEFAULT_LIMIT));
  }
}
