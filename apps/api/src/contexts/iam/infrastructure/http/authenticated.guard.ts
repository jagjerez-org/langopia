import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { DomainError } from "../../../shared/domain/errors/domain-error.js";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../shared/domain/ports/tenant-context.port.js";
import {
  IMPERSONATION_RESTRICTED_KEY,
  PUBLIC_KEY,
  ROLES_KEY,
} from "../../../shared/infrastructure/http/roles.decorator.js";
import { FORBIDDEN_WHILE_IMPERSONATING } from "../../domain/model/impersonation-rules.js";

/**
 * `required` y `actual` viajan como texto ya unido, no como arrays.
 *
 * El catálogo interpola `{required}` («Esta acción requiere el rol
 * {required}.»), y un array no es un valor simple para `IntlMessageFormat`:
 * no lanza, devuelve un array mezclando texto y el valor sin convertir. El
 * filtro de errores lo detecta como traducción fallida y cae al mensaje del
 * `super()`, que está en español — así que los cinco idiomas devolvían el
 * mismo texto castellano con el catálogo aparentemente completo. Los `params`
 * de un mensaje son los `details` del error: se declaran juntos, y eso
 * incluye su tipo.
 */
export class ForbiddenRoleError extends DomainError {
  readonly code = "insufficient_role";
  readonly kind = "forbidden" as const;
  constructor(required: readonly string[], actual: readonly string[]) {
    super(`Esta acción requiere el rol ${required.join(" o ")}.`, {
      required: required.join(", "),
      actual: actual.join(", "),
    });
  }
}

/**
 * La ruta no declaró NADA: ni `@Roles(...)` ni `@Public()`.
 *
 * No es un error de quien llama, es un error de quien escribió el endpoint —
 * y por eso el mensaje no promete que con otro rol se pueda: dice que la
 * ruta no está disponible. Que exista este error es la mitad del «fallo por
 * defecto es denegar»; la otra mitad es `routes-declare-roles.spec.ts`, que
 * lo convierte en un fallo de la batería en vez de en un 403 en producción.
 */
export class MissingRoleAnnotationError extends DomainError {
  readonly code = "route_not_annotated";
  readonly kind = "forbidden" as const;
  constructor() {
    super("Esta ruta no declara quién puede usarla, así que no se sirve.");
  }
}

/**
 * La lista de acciones prohibidas mientras se impersona vive en el dominio
 * (`FORBIDDEN_WHILE_IMPERSONATING`, `contexts/iam/domain/model/
 * impersonation-rules.ts`): este error solo la CITA, para que el `code` que
 * ve el cliente diga qué categoría de acción rechazó, sin repetir la lista.
 */
export class ImpersonationForbiddenActionError extends DomainError {
  readonly code = "impersonation_forbidden_action";
  readonly kind = "forbidden" as const;
  constructor(action: string) {
    super(
      `Esta acción («${action}») no se puede hacer mientras se impersona a otra persona.`,
      { action },
    );
  }
}

/**
 * La ruta se anotó como restringida durante la impersonación, pero con un
 * valor que no está en `FORBIDDEN_WHILE_IMPERSONATING`. Una errata, casi
 * siempre — y la consecuencia de dejarla pasar es una restricción que no
 * restringe. Se deniega, como cualquier otra ruta mal anotada.
 */
export class UnknownRestrictedActionError extends DomainError {
  readonly code = "unknown_restricted_action";
  readonly kind = "forbidden" as const;
  constructor(action: string) {
    super(`«${action}» no es una acción restringida conocida.`, { action });
  }
}

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const esPublico = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (esPublico) return true;

    // Lanza `missing_tenant` (403) si no hay sesión: es la comprobación de que
    // el interceptor pudo resolver una escuela para esta persona.
    this.tenant.schoolId();

    // Saneamiento de cierre de la ola 1: SIN anotación, se deniega.
    //
    // Antes esto era al revés —«si no hay `@Roles`, pasa»—, que es la regla
    // vinculante del proyecto («toda ruta necesita anotación de roles: el
    // fallo por defecto es denegar») escrita justo al contrario. Hacía poco
    // daño con dos endpoints así, pero cada endpoint nuevo que alguien
    // olvidara anotar nacía abierto de par en par: `student` y `guardian`
    // incluidos. Con la inversión, olvidarse es un 403 inmediato en la
    // primera llamada, y `routes-declare-roles.spec.ts` lo adelanta a la
    // batería para que ni siquiera llegue a desplegarse.
    const requeridos = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requeridos || requeridos.length === 0) {
      throw new MissingRoleAnnotationError();
    }
    const actuales = this.tenant.roles();
    if (!requeridos.some((r) => actuales.includes(r))) {
      throw new ForbiddenRoleError(requeridos, actuales);
    }

    // Tarea 17: el guardia de roles rechaza aquí, en un único sitio, para
    // que ningún endpoint nuevo se olvide de comprobarlo. Se mira DESPUÉS
    // del rol porque un 403 por rol insuficiente no debe filtrar, de paso,
    // que la petición además estaba impersonando a alguien.
    //
    // Tarea 10 (bug real, encontrado por la prueba de extremo a extremo):
    // esto comprobaba `impersonatorMembershipId()`, que es `null` NO SOLO
    // cuando no hay impersonación, sino TAMBIÉN cuando quien impersona es
    // soporte de la plataforma sin membresía propia en la escuela — que es
    // el caso de uso principal de la Tarea 17, documentado así en el propio
    // puerto (`tenant-context.port.ts`). Con esa comprobación, soporte
    // impersonando sin membresía propia se saltaba las seis categorías
    // prohibidas enteras (pagos, RGPD, consentimientos...), justo el ataque
    // que este mecanismo existe para cortar. La señal correcta de «¿hay una
    // impersonación activa, sí o no?» es `impersonationId()`, no de quién.
    const accionRestringida = this.reflector.getAllAndOverride<string | undefined>(
      IMPERSONATION_RESTRICTED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (accionRestringida !== undefined) {
      // Saneamiento de cierre de la ola 1: el valor tiene que ser uno de la
      // lista cerrada del dominio. El tipo del decorador ya lo exige, pero
      // eso solo vale para quien compile este repositorio: una anotación que
      // llegue por un `as`, o desde código generado, dejaba una restricción
      // que no restringía nada —el `if` de abajo comparaba una cadena que no
      // reconoce nadie— y lo hacía en silencio, justo en los endpoints que
      // más falta hace que la lleven. Se falla cerrado, igual que con la
      // anotación de roles: una ruta mal anotada no se sirve.
      if (!(FORBIDDEN_WHILE_IMPERSONATING as readonly string[]).includes(accionRestringida)) {
        throw new UnknownRestrictedActionError(accionRestringida);
      }
      if (this.tenant.impersonationId?.()) {
        throw new ImpersonationForbiddenActionError(accionRestringida);
      }
    }

    return true;
  }
}
