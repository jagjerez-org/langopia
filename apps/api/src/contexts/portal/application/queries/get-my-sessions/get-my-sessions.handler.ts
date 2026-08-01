import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import {
  PORTAL_READ_MODEL,
  type PortalReadModel,
  type PortalSessionEntry,
} from "../../ports/portal-read-model.port.js";
import { resolvePortalStudentId } from "../../resolve-portal-student.js";

export class GetMySessionsQuery extends Query<PortalSessionEntry[]> {
  constructor(readonly props: { studentId?: string }) {
    super();
  }
}

/**
 * «Mis clases» del portal del alumno. Ver `resolvePortalStudentId` para de
 * quién son «mis».
 */
@QueryHandler(GetMySessionsQuery)
export class GetMySessionsHandler implements IQueryHandler<GetMySessionsQuery> {
  constructor(
    @Inject(PORTAL_READ_MODEL) private readonly readModel: PortalReadModel,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  async execute(query: GetMySessionsQuery): Promise<PortalSessionEntry[]> {
    const studentId = await resolvePortalStudentId(
      this.readModel,
      this.tenant.membershipId() ?? "",
      query.props.studentId,
    );
    if (!studentId) return [];
    return this.readModel.sessionsForStudent(studentId);
  }
}
