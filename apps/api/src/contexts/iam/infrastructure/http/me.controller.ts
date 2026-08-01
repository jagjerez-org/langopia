import { Controller, Get, Inject } from "@nestjs/common";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../shared/domain/ports/tenant-context.port.js";
import { Roles } from "../../../shared/infrastructure/http/roles.decorator.js";

/**
 * Quién soy en la escuela activa: mi membresía y mis roles.
 *
 * Tarea 11 del panel (Portal del alumno y aula del profesor): hasta ahora
 * ningún adaptador de entrada exponía esto al cliente — cada pantalla previa
 * (panel de dirección, alumnado, calendario) daba por hecho que quien mira es
 * personal de la escuela, así que nunca hizo falta que el panel supiera su
 * propio rol. Esta es la primera pantalla que sirve a `student` y `guardian`
 * A LA VEZ que a dirección y profesorado, y necesita decidir qué navegación
 * mostrar y, en el caso de un tutor legal, con qué membresía actúa — sin ese
 * dato, no hay forma honesta de armar el menú ni de resolver la ficha propia.
 *
 * Sin lógica de negocio, igual que cualquier otro adaptador de entrada: se
 * limita a leer `TenantContext`, que ya resolvió `SessionTenantGuard` (o la
 * impersonación activa, Tarea 17) antes de llegar aquí. `@Roles` con los
 * cinco roles porque cualquier membresía necesita saber quién es.
 */
@Controller("iam/me")
export class MeController {
  constructor(@Inject(TENANT_CONTEXT) private readonly tenant: TenantContext) {}

  @Roles("owner", "admin", "teacher", "student", "guardian")
  @Get()
  me(): { membershipId: string | null; roles: string[] } {
    return {
      membershipId: this.tenant.membershipId(),
      roles: [...this.tenant.roles()],
    };
  }
}
