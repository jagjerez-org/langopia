import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import {
  PORTAL_READ_MODEL,
  type PortalInvoiceEntry,
  type PortalReadModel,
} from "../../ports/portal-read-model.port.js";
import { resolvePortalStudentId } from "../../resolve-portal-student.js";

export class GetMyInvoicesQuery extends Query<PortalInvoiceEntry[]> {
  constructor(readonly props: { studentId?: string }) {
    super();
  }
}

/**
 * «Mis facturas» del portal del alumno.
 *
 * Es el endpoint del Paso 4: pedir el `studentId` de otro alumno de la misma
 * escuela —sin ser su tutor— no filtra en silencio, lanza
 * `PortalAccessDeniedError` (403) desde `resolvePortalStudentId`.
 */
@QueryHandler(GetMyInvoicesQuery)
export class GetMyInvoicesHandler implements IQueryHandler<GetMyInvoicesQuery> {
  constructor(
    @Inject(PORTAL_READ_MODEL) private readonly readModel: PortalReadModel,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  async execute(query: GetMyInvoicesQuery): Promise<PortalInvoiceEntry[]> {
    const studentId = await resolvePortalStudentId(
      this.readModel,
      this.tenant.membershipId() ?? "",
      query.props.studentId,
    );
    if (!studentId) return [];
    return this.readModel.invoicesForStudent(studentId);
  }
}
