import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import { canAccessPersonalData } from "../../../domain/model/personal-data-access.js";
import { PersonalDataAccessDeniedError } from "../../../domain/errors/personal-data.errors.js";
import {
  PERSONAL_DATA_READ_MODEL,
  type PersonalDataExport,
  type PersonalDataReadModel,
} from "../../ports/personal-data-read-model.port.js";

export class ExportPersonalDataQuery extends Query<PersonalDataExport> {
  constructor(readonly props: { membershipId: string }) {
    super();
  }
}

/**
 * Derecho de acceso y portabilidad (Tarea 15, RGPD).
 *
 * «Lo puede pedir la propia persona, su tutor si es menor, o la dirección»
 * (brief, verbatim): `canAccessPersonalData()` es quien decide eso, sobre el
 * `PersonAccessContext` que trae el modelo de lectura. El propio `not_found`
 * es RLS diciendo que esa membresía no existe EN ESTA ESCUELA — 404, no un
 * 403 que confirmaría que la fila existe en otro sitio.
 */
@QueryHandler(ExportPersonalDataQuery)
export class ExportPersonalDataHandler implements IQueryHandler<ExportPersonalDataQuery> {
  constructor(
    @Inject(PERSONAL_DATA_READ_MODEL) private readonly readModel: PersonalDataReadModel,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  async execute(query: ExportPersonalDataQuery): Promise<PersonalDataExport> {
    const { membershipId } = query.props;
    const target = await this.readModel.accessContext(membershipId);
    if (!target) throw new NotFoundError("la persona", membershipId);

    const requesterMembershipId = this.tenant.membershipId();
    const allowed =
      requesterMembershipId !== null &&
      canAccessPersonalData({
        requesterMembershipId,
        requesterRoles: this.tenant.roles(),
        target,
      });
    if (!allowed) throw new PersonalDataAccessDeniedError(membershipId);

    return this.readModel.exportFor(membershipId);
  }
}
