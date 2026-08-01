import { Controller, Get, Inject, Param } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../shared/domain/ports/tenant-context.port.js";
import { Roles } from "../../../shared/infrastructure/http/roles.decorator.js";
import { DueCardsAccessDeniedError } from "../../domain/errors/learning.errors.js";
import { STUDENT_SELF_PORT, type StudentSelfPort } from "../../domain/ports/student-self.port.js";
import { GetDueCardsQuery } from "../../application/queries/get-due-cards/get-due-cards.handler.js";

/**
 * Adaptador de ENTRADA sobre HTTP: repaso diario (tarea 12 de la ola 2,
 * paso 4), autoservicio del alumno. `student`/`guardian`, nunca dirección ni
 * profesorado — el repaso de un alumno concreto es exactamente el tipo de
 * dato personal («qué ha fallado») que esta ola pide proteger.
 *
 * La comprobación de que esta membresía puede de verdad ver el repaso de
 * `studentId` vive aquí, no en `GetDueCardsHandler` (tarea 9): esa consulta
 * ya existía, sin controlador, con la nota explícita de que la Tarea 12 la
 * consumiría — añadirle ahora una dependencia nueva (`TenantContext`,
 * `StudentSelfPort`) habría tocado un manejador ya probado en otra tarea sin
 * necesidad, cuando la propia guarda de acceso no decide nada del REPASO en
 * sí (qué tarjetas hay, en qué orden), solo QUIÉN puede pedirlo — el mismo
 * tipo de comprobación que ya hace un `Guard` de NestJS en este código base.
 */
@Roles("student", "guardian")
@Controller("learning/students")
export class ExercisesController {
  constructor(
    private readonly queries: QueryBus,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(STUDENT_SELF_PORT) private readonly studentSelf: StudentSelfPort,
  ) {}

  @Get(":studentId/due-cards")
  async dueCards(@Param("studentId") studentId: string) {
    const membershipId = this.tenant.membershipId();
    const allowed = membershipId
      ? await this.studentSelf.isSelfOrGuardian(membershipId, studentId)
      : false;
    if (!allowed) throw new DueCardsAccessDeniedError(studentId);

    return this.queries.execute(new GetDueCardsQuery({ studentProfileId: studentId }));
  }
}
