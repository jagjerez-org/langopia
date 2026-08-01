import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { ImpersonationId } from "../../../domain/model/impersonation.aggregate.js";
import {
  IMPERSONATION_REPOSITORY,
  type ImpersonationRepositoryPort,
} from "../../../domain/ports/impersonation-repository.port.js";

export type ActiveImpersonationView = {
  impersonationId: string;
  targetMembershipId: string;
  targetName: string;
  impersonatorName: string;
  impersonatorEmail: string;
  reason: string;
  involvesMinor: boolean;
  startedAt: string;
  expiresAt: string;
};

/**
 * El aviso permanente del panel (paso 10 del brief) necesita saber, en cada
 * pantalla: quién eres, a quién representas y cuánto queda. Esta consulta es
 * lo que esa pantalla pide para pintarlo. Devuelve `null` fuera de una
 * impersonación — el panel simplemente no pinta el aviso.
 */
export class GetActiveImpersonationQuery extends Query<ActiveImpersonationView | null> {}

@QueryHandler(GetActiveImpersonationQuery)
export class GetActiveImpersonationHandler implements IQueryHandler<GetActiveImpersonationQuery> {
  constructor(
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(IMPERSONATION_REPOSITORY) private readonly repository: ImpersonationRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async execute(): Promise<ActiveImpersonationView | null> {
    const impersonationId = this.tenant.impersonationId?.();
    if (!impersonationId) return null;

    return this.uow.read(async () => {
      const impersonation = await this.repository.findById(ImpersonationId.of(impersonationId));
      if (!impersonation || impersonation.hasEnded) return null;

      const target = await this.repository.findTargetMembership(impersonation.targetMembershipId);

      return {
        impersonationId: impersonation.id.value,
        targetMembershipId: impersonation.targetMembershipId,
        targetName: target?.name ?? "",
        impersonatorName: impersonation.impersonatorName,
        impersonatorEmail: impersonation.impersonatorEmail,
        reason: impersonation.reason,
        involvesMinor: impersonation.involvesMinor,
        startedAt: impersonation.startedAt.toISOString(),
        expiresAt: impersonation.expiresAt.toISOString(),
      };
    });
  }
}
