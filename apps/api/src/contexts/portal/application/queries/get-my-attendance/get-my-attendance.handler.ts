import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import {
  PORTAL_READ_MODEL,
  type PortalAttendanceEntry,
  type PortalReadModel,
} from "../../ports/portal-read-model.port.js";
import { resolvePortalStudentId } from "../../resolve-portal-student.js";

export class GetMyAttendanceQuery extends Query<PortalAttendanceEntry[]> {
  constructor(readonly props: { studentId?: string }) {
    super();
  }
}

/** «Mi asistencia» del portal del alumno. */
@QueryHandler(GetMyAttendanceQuery)
export class GetMyAttendanceHandler implements IQueryHandler<GetMyAttendanceQuery> {
  constructor(
    @Inject(PORTAL_READ_MODEL) private readonly readModel: PortalReadModel,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  async execute(query: GetMyAttendanceQuery): Promise<PortalAttendanceEntry[]> {
    const studentId = await resolvePortalStudentId(
      this.readModel,
      this.tenant.membershipId() ?? "",
      query.props.studentId,
    );
    if (!studentId) return [];
    return this.readModel.attendanceForStudent(studentId);
  }
}
