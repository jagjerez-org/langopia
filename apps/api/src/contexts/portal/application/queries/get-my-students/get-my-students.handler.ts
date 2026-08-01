import { Inject } from "@nestjs/common";
import { Query, QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../../shared/domain/ports/tenant-context.port.js";
import {
  PORTAL_READ_MODEL,
  type PortalReadModel,
  type PortalStudentOption,
} from "../../ports/portal-read-model.port.js";

export class GetMyStudentsQuery extends Query<PortalStudentOption[]> {}

/**
 * Alumnos que esta membresía puede elegir en el portal (Tarea 11 del panel
 * web, Paso 2: «un tutor con dos hijos ve a los dos y cambia entre ellos»).
 *
 * Sin parámetros: a diferencia de `GetMySessionsQuery` y compañía, esta
 * consulta no filtra por un `studentId` pedido — es justo la que responde
 * "¿cuáles son las opciones?", para que el panel arme el selector ANTES de
 * pedir "mis clases" de uno en concreto. Una lista vacía (una membresía sin
 * ficha de alumno propia y sin tutelados: no debería ocurrir con los roles
 * `student`/`guardian`, pero la consulta no lo da por hecho) no es un error.
 */
@QueryHandler(GetMyStudentsQuery)
export class GetMyStudentsHandler implements IQueryHandler<GetMyStudentsQuery> {
  constructor(
    @Inject(PORTAL_READ_MODEL) private readonly readModel: PortalReadModel,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  async execute(): Promise<PortalStudentOption[]> {
    return this.readModel.myStudents(this.tenant.membershipId() ?? "");
  }
}
