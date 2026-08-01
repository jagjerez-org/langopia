import { Injectable } from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import { DomainError } from "../../domain/errors/domain-error.js";
import type { TenantContext } from "../../domain/ports/tenant-context.port.js";

export const CLS_SCHOOL_ID = "tenant:schoolId";
export const CLS_MEMBERSHIP_ID = "tenant:membershipId";
export const CLS_ROLES = "tenant:roles";
/**
 * Membresía REAL de quien impersona (Tarea 17). La fija `SessionTenantGuard`
 * junto al resto del contexto SOLO cuando la petición ocurre dentro de una
 * impersonación activa; en cualquier otra petición queda sin definir, y
 * `impersonatorMembershipId()` devuelve `null`. `CLS_MEMBERSHIP_ID`, mientras
 * tanto, pasa a llevar la membresía IMPERSONADA: es la que decide escuela y
 * roles, para que RLS siga aislando por la escuela de la persona impersonada.
 */
export const CLS_IMPERSONATOR_MEMBERSHIP_ID = "tenant:impersonatorMembershipId";
/**
 * Identificador de la impersonación activa (Tarea 17), si la hay. Lo lee
 * `ImpersonationController` para saber CUÁL terminar sin volver a preguntar
 * a la base de datos, y el aviso permanente del panel para pintar cuánto
 * queda.
 */
export const CLS_IMPERSONATION_ID = "tenant:impersonationId";
export const CLS_IMPERSONATION_EXPIRES_AT = "tenant:impersonationExpiresAt";
/**
 * Identificador de la petición (Tarea 8c, registro unificado). Lo genera
 * `SessionTenantGuard` en el primer punto por el que pasa cualquier
 * petición, antes incluso de saber si hay tenant. Es el mismo valor que sale
 * en la cabecera `x-request-id` de la respuesta, en `traceId` del cuerpo de
 * error (`AllExceptionsFilter`) y en cada línea de registro de la petición:
 * uno solo, de principio a fin.
 */
export const CLS_TRACE_ID = "trace:id";
/**
 * Idioma resuelto para la petición (Tarea 8). Lo fija el adaptador de entrada
 * que resuelve el tenant, con `resolveLocale(...)`, junto al resto del
 * contexto; lo lee el filtro de errores para traducir `translateError(code,
 * locale, params)`.
 */
export const CLS_LOCALE = "tenant:locale";

export class MissingTenantError extends DomainError {
  readonly code = "missing_tenant";
  readonly kind = "forbidden" as const;

  constructor() {
    super(
      "No hay escuela en el contexto de la petición. Toda operación pertenece a una escuela.",
    );
  }
}

/**
 * Contexto de tenant sobre almacenamiento local por petición.
 *
 * Lo rellena un adaptador de entrada —el interceptor HTTP, el servidor MCP, un
 * consumidor de cola— y lo lee todo lo demás sin pasárselo como parámetro.
 *
 * `schoolId()` lanza si no hay escuela en vez de devolver `null`. Es a
 * propósito: un fallo ruidoso al principio de la petición es preferible a una
 * consulta que se ejecuta sin filtro y devuelve datos de todo el mundo.
 */
@Injectable()
export class ClsTenantContext implements TenantContext {
  constructor(private readonly cls: ClsService) {}

  schoolId(): string {
    const value = this.cls.get<string | undefined>(CLS_SCHOOL_ID);
    if (!value) throw new MissingTenantError();
    return value;
  }

  membershipId(): string | null {
    return this.cls.get<string | undefined>(CLS_MEMBERSHIP_ID) ?? null;
  }

  roles(): readonly string[] {
    return this.cls.get<string[] | undefined>(CLS_ROLES) ?? [];
  }

  has(role: string): boolean {
    return this.roles().includes(role);
  }

  impersonationId(): string | null {
    return this.cls.get<string | undefined>(CLS_IMPERSONATION_ID) ?? null;
  }

  impersonatorMembershipId(): string | null {
    return this.cls.get<string | undefined>(CLS_IMPERSONATOR_MEMBERSHIP_ID) ?? null;
  }
}
