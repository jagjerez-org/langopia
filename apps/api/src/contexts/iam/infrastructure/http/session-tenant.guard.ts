import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { randomUUID } from "node:crypto";
import { ClsService } from "nestjs-cls";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import type { Request, Response } from "express";
import { DomainError } from "../../../shared/domain/errors/domain-error.js";
import { resolveLocale } from "../../../shared/infrastructure/i18n/locale.resolver.js";
import { PUBLIC_KEY } from "../../../shared/infrastructure/http/roles.decorator.js";
import {
  CLS_IMPERSONATION_ID,
  CLS_IMPERSONATOR_MEMBERSHIP_ID,
  CLS_LOCALE,
  CLS_MEMBERSHIP_ID,
  CLS_ROLES,
  CLS_SCHOOL_ID,
  CLS_TRACE_ID,
} from "../../../shared/infrastructure/tenant/cls-tenant-context.js";
import {
  IMPERSONATION_DIRECTORY,
  type ImpersonationDirectoryPort,
} from "../../domain/ports/impersonation-directory.port.js";
import {
  MEMBERSHIP_LOOKUP,
  type MembershipLookupPort,
  type MembershipRow,
} from "../../domain/ports/membership-lookup.port.js";
import { AUTH, type Auth } from "../auth/better-auth.config.js";

export type { MembershipRow };

/**
 * Una escuela, con TODOS los roles que la persona tiene en ella.
 *
 * `memberships` admite varias filas por (escuela, persona) —el índice único es
 * `(school_id, user_id, role)`—, así que un dueño que además da clase aparece
 * dos veces. Antes eso se traducía en «Perteneces a varias escuelas:
 * atlantico, atlantico» y en un `CLS_MEMBERSHIP_ID` que dependía del orden en
 * que Postgres devolviera las filas.
 */
export type SchoolMembership = {
  membershipId: string;
  schoolId: string;
  schoolSlug: string;
  schoolLocale?: string | null;
  schoolStatus: string;
  roles: string[];
};

/**
 * Estados de escuela que permiten entrar, y por qué.
 *
 *   trial, active → sin discusión.
 *   past_due      → SÍ. El impago es de la suscripción de la escuela a la
 *                   plataforma, un asunto comercial entre nosotros y su dueño.
 *                   Cortarle el acceso deja tirados a alumnos y profesores, que
 *                   no han hecho nada, y borra el calendario de la semana. La
 *                   palanca de cobro es el aviso y, al final, la cancelación.
 *   canceled      → NO. La escuela ya no existe para el producto; ni su dueño
 *                   entra. La recuperación de datos es un procedimiento aparte,
 *                   no un inicio de sesión.
 *
 * Es una decisión explícita, no un olvido: antes se entraba en cualquier estado.
 */
export const SCHOOL_STATUSES_THAT_ALLOW_ACCESS: readonly string[] = ["trial", "active", "past_due"];

/**
 * Forma admisible de un slug de escuela: lo mismo que acepta `schools.slug`.
 *
 * Se valida ANTES de buscarlo y antes de reflejarlo en un error o en el
 * registro. Lo que llega en el `Host` o en `x-school-slug` lo escribe el
 * cliente, y devolverlo tal cual convierte un mensaje de error en un espejo
 * para inyectar lo que sea en el visor de registros de quien lo lea.
 */
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Etiquetas que nunca son una escuela aunque estén en el sitio del subdominio. */
const RESERVED_SUBDOMAINS = new Set(["www", "api", "app", "admin", "static", "cdn"]);

/** Dominios base sobre los que un subdominio identifica a una escuela. */
const DEFAULT_BASE_DOMAINS = ["langopia.app", "localhost"];

export class TenantResolutionError extends DomainError {
  readonly code = "tenant_resolution_failed";
  readonly kind = "forbidden" as const;
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, details);
  }
}

export class SchoolNotOperationalError extends DomainError {
  readonly code = "school_not_operational";
  readonly kind = "forbidden" as const;
  constructor(slug: string, status: string) {
    super(`La escuela «${slug}» está cancelada y no admite accesos.`, { slug, status });
  }
}

export class EmailNotVerifiedError extends DomainError {
  readonly code = "email_not_verified";
  readonly kind = "forbidden" as const;
  constructor() {
    super(
      "Tu correo todavía no está verificado. Abre el enlace que te hemos enviado antes de entrar.",
    );
  }
}

/**
 * Agrupa las filas de membresía por escuela, de forma determinista.
 *
 * Determinista importa: `CLS_MEMBERSHIP_ID` acaba en `app.membership_id` y en
 * la auditoría, así que dos peticiones idénticas no pueden atribuirse a
 * membresías distintas según el humor del planificador de Postgres. Se ordena
 * por slug, y dentro de cada escuela por identificador de membresía; los roles
 * salen ordenados y sin repetir.
 */
export function groupBySchool(rows: readonly MembershipRow[]): SchoolMembership[] {
  const porEscuela = new Map<string, MembershipRow[]>();
  for (const row of rows) {
    const grupo = porEscuela.get(row.schoolId);
    if (grupo) grupo.push(row);
    else porEscuela.set(row.schoolId, [row]);
  }

  return [...porEscuela.values()]
    .map((grupo) => {
      const ordenadas = [...grupo].sort((a, b) => a.membershipId.localeCompare(b.membershipId));
      const primera = ordenadas[0]!;
      return {
        membershipId: primera.membershipId,
        schoolId: primera.schoolId,
        schoolSlug: primera.schoolSlug,
        schoolLocale: primera.schoolLocale,
        schoolStatus: primera.schoolStatus,
        roles: [...new Set(ordenadas.map((m) => m.role))].sort(),
      };
    })
    .sort((a, b) => a.schoolSlug.localeCompare(b.schoolSlug));
}

function puedeEntrar(escuela: SchoolMembership): boolean {
  return SCHOOL_STATUSES_THAT_ALLOW_ACCESS.includes(escuela.schoolStatus);
}

/**
 * El mismo filtro de estado, para las escuelas que NO llegan como membresía.
 *
 * Saneamiento de cierre de la ola 1: la impersonación resolvía su tenant por
 * otro camino —`active_impersonation_for_impersonator`, no `resolveTenant`—
 * y ese camino no miraba el estado de la escuela. Resultado: una escuela
 * `canceled`, en la que su propio dueño ya no puede entrar, seguía abierta
 * para quien la impersonara. Justo al revés de lo que dice la decisión de
 * `SCHOOL_STATUSES_THAT_ALLOW_ACCESS`: «la escuela ya no existe para el
 * producto; ni su dueño entra».
 */
export function assertSchoolAllowsAccess(slug: string, status: string): void {
  if (!SCHOOL_STATUSES_THAT_ALLOW_ACCESS.includes(status)) {
    throw new SchoolNotOperationalError(slug, status);
  }
}

/**
 * Decide en qué escuela actúa esta petición.
 *
 * La lista de membresías sale de la sesión verificada, así que el cliente no
 * puede inventarse una escuela: como mucho puede pedir una a la que YA
 * pertenece. Ese es el cambio esencial respecto del interceptor de cabeceras.
 */
export function resolveTenant(
  rows: readonly MembershipRow[],
  requestedSlug: string | undefined,
): SchoolMembership {
  const escuelas = groupBySchool(rows);
  if (escuelas.length === 0) {
    throw new TenantResolutionError("No perteneces a ninguna escuela.");
  }

  if (requestedSlug !== undefined) {
    if (!SLUG_PATTERN.test(requestedSlug)) {
      // El valor NO se refleja: es lo que se pedía comprobar.
      throw new TenantResolutionError(
        "El identificador de escuela pedido no tiene un formato válido.",
        { length: requestedSlug.length },
      );
    }
    const encontrada = escuelas.find((m) => m.schoolSlug === requestedSlug);
    if (!encontrada) {
      throw new TenantResolutionError(`No perteneces a la escuela «${requestedSlug}».`, {
        requestedSlug,
      });
    }
    assertSchoolAllowsAccess(encontrada.schoolSlug, encontrada.schoolStatus);
    return encontrada;
  }

  const usables = escuelas.filter(puedeEntrar);
  if (usables.length === 0) {
    // Incondicional a propósito: aquí ya se sabe que NINGUNA pasa el filtro,
    // y un `assert` que solo lanza a veces dejaría caer la ejecución al
    // `return usables[0]!` de abajo, que con la lista vacía es `undefined`.
    const primera = escuelas[0]!;
    throw new SchoolNotOperationalError(primera.schoolSlug, primera.schoolStatus);
  }
  if (usables.length > 1) {
    throw new TenantResolutionError(
      "Perteneces a varias escuelas: indica la escuela en el subdominio o en la cabecera x-school-slug.",
      { schools: usables.map((m) => m.schoolSlug) },
    );
  }
  return usables[0]!;
}

/**
 * Extrae el slug de escuela del `Host`, y solo sobre los dominios que conocemos.
 *
 * La versión anterior tomaba la primera etiqueta de cualquier host con tres o
 * más: en `xxx.up.railway.app` el slug salía `xxx` y en `10.0.1.5`, `10`, así
 * que toda petición autenticada moría con 403 en cuanto el servicio no se
 * sirviera desde `*.langopia.app`. Fallaba cerrado, sí, pero cerrado del todo.
 *
 * Ahora el reconocimiento se limita a los dominios base configurados y a UNA
 * etiqueta por delante. Fuera de esa lista el host se ignora y manda la
 * cabecera, que es lo que quiere un despliegue detrás de un dominio prestado.
 */
export function subdomainFrom(
  host: string | undefined,
  baseDomains: readonly string[],
): string | undefined {
  const limpio = (host ?? "").split(":")[0]?.trim().toLowerCase();
  if (!limpio) return undefined;

  for (const base of baseDomains) {
    if (!limpio.endsWith(`.${base}`)) continue;
    const etiqueta = limpio.slice(0, -(base.length + 1));
    // Solo un nivel: `a.b.langopia.app` no es la escuela «a».
    if (etiqueta.includes(".")) return undefined;
    if (RESERVED_SUBDOMAINS.has(etiqueta)) return undefined;
    return etiqueta;
  }
  return undefined;
}

/**
 * Fija el tenant de la petición ANTES de que se compruebe el rol.
 *
 * Es una guardia, no un interceptor, a propósito: NestJS ejecuta todas las
 * guardias antes que cualquier interceptor, así que un `AuthenticatedGuard`
 * que lea `TENANT_CONTEXT` nunca vería lo que este fichero deja en el CLS si
 * viviera en la fase de interceptores. Se registra en `app.module.ts` como
 * `APP_GUARD` justo antes que `AuthenticatedGuard`.
 */
@Injectable()
export class SessionTenantGuard implements CanActivate {
  private readonly baseDomains: string[];

  constructor(
    private readonly cls: ClsService,
    private readonly reflector: Reflector,
    config: ConfigService,
    @Inject(MEMBERSHIP_LOOKUP) private readonly memberships: MembershipLookupPort,
    @Inject(IMPERSONATION_DIRECTORY) private readonly impersonations: ImpersonationDirectoryPort,
    @Inject(AUTH) private readonly auth: Auth,
    @InjectPinoLogger(SessionTenantGuard.name) private readonly logger: PinoLogger,
  ) {
    this.baseDomains = (config.get<string>("TENANT_BASE_DOMAINS") ?? DEFAULT_BASE_DOMAINS.join(","))
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Se genera aquí, en el borde: este guardia es lo primero por lo que
    // pasa CUALQUIER petición (con sesión o sin ella, pública o no), así que
    // es el único sitio que ve a la vez a todas. Reutilizar el
    // `x-request-id` que ya traiga la petición (típico detrás de un proxy
    // que lo genera él mismo) evita tener dos identificadores para lo mismo.
    // A partir de aquí vive en CLS, junto al resto del contexto de tenant:
    // el registro de un caso de uso y el de `AllExceptionsFilter` lo leen de
    // ahí y comparten valor sin coordinarse, y la respuesta lo devuelve en
    // la misma cabecera con la que llegó.
    const incoming = header(request, "x-request-id");
    const traceId = incoming && incoming.length > 0 ? incoming : randomUUID();
    this.cls.set(CLS_TRACE_ID, traceId);
    response.setHeader("x-request-id", traceId);

    // Las rutas de autenticación no tienen tenant todavía.
    if (request.path.startsWith("/api/v1/auth")) return true;

    // Una ruta pública se sirve igual con sesión que sin ella: no se resuelve
    // tenant y, por tanto, tampoco se rechaza a nadie por no haberlo resuelto.
    const esPublica = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (esPublica) return true;

    const headers = new Headers();
    if (request.headers.cookie) headers.set("cookie", request.headers.cookie);
    const session = await this.auth.api.getSession({ headers });
    if (!session) {
      // Seguir es correcto —hay rutas públicas—, pero no en silencio: sin esta
      // línea, un fallo de cookie se manifiesta como un 403 sin causa visible.
      this.logger.debug(`petición sin sesión: no se fija tenant (${request.path})`);
      return true;
    }

    // Tener una sesión no es tener una identidad. La verificación del correo
    // sigue siendo obligatoria aunque el tenant ya no se resuelva por correo:
    // es la prueba de que quien tiene la credencial es quien dice ser, y de
    // ella dependen la invitación por correo y el aprovisionamiento que
    // vendrán después. Better Auth ya bloquea el inicio de sesión sin
    // verificar (`requireEmailVerification`), pero eso es configuración; esto
    // es la puerta, y la puerta se cierra aquí también.
    if (!session.user.emailVerified) {
      this.logger.warn(
        `sesión con correo sin verificar: no se fija tenant (usuario ${session.user.id})`,
      );
      throw new EmailNotVerifiedError();
    }

    // Tarea 17: antes de resolver el tenant NORMAL de quien tiene la sesión,
    // se comprueba si esta credencial tiene AHORA MISMO una impersonación
    // abierta como quien impersona. Si la tiene, el tenant EFECTIVO pasa a
    // ser el de la persona impersonada — escuela, membresía y roles—, y no
    // el propio. RLS sigue mandando sobre `app.school_id`, así que un
    // soporte actuando como alguien de la escuela A sigue sin ver una fila
    // de la B con solo cambiar de membresía. La función SQL de base ya
    // descarta las impersonaciones caducadas (`expires_at > now()`): una que
    // superó los 30 minutos deja de encontrarse aquí sin que nadie tenga que
    // cerrarla a mano, y la petición cae al camino normal, con el tenant
    // REAL de quien la hace.
    const activeImpersonation = await this.impersonations.activeAsImpersonator(session.user.id);
    if (activeImpersonation) {
      // El estado de la escuela se comprueba ANTES de fijar nada: si no
      // admite accesos, esta petición no llega a tener tenant. Es el mismo
      // criterio que `resolveTenant` aplica a una sesión normal, y hasta
      // ahora era el único camino que se lo saltaba.
      assertSchoolAllowsAccess(
        activeImpersonation.targetSchoolSlug,
        activeImpersonation.targetSchoolStatus,
      );
      this.cls.set(CLS_SCHOOL_ID, activeImpersonation.schoolId);
      this.cls.set(CLS_MEMBERSHIP_ID, activeImpersonation.targetMembershipId);
      this.cls.set(CLS_ROLES, [activeImpersonation.targetRole]);
      this.cls.set(CLS_IMPERSONATION_ID, activeImpersonation.impersonationId);
      if (activeImpersonation.impersonatorMembershipId) {
        this.cls.set(CLS_IMPERSONATOR_MEMBERSHIP_ID, activeImpersonation.impersonatorMembershipId);
      }
      this.cls.set(
        CLS_LOCALE,
        resolveLocale({
          user: null,
          school: activeImpersonation.targetSchoolLocale,
          header: header(request, "accept-language"),
        }),
      );
      return true;
    }

    // Por identificador de credencial, no por correo. Registrarse con el
    // correo del dueño de una escuela ya no lleva a ninguna parte: la fila de
    // `users` de ese dueño apunta a OTRA credencial (o a ninguna), así que la
    // consulta devuelve cero membresías y el impostor se queda fuera.
    const rows = await this.memberships.activeFor(session.user.id);

    const slug =
      subdomainFrom(request.get("host"), this.baseDomains) ?? header(request, "x-school-slug");
    const chosen = resolveTenant(rows, slug);

    this.cls.set(CLS_SCHOOL_ID, chosen.schoolId);
    this.cls.set(CLS_MEMBERSHIP_ID, chosen.membershipId);
    this.cls.set(CLS_ROLES, chosen.roles);
    // Tarea 8b: cierra el Paso 6 de la Tarea 8, que se dejó pendiente aquí
    // por la advertencia de concurrencia sobre `iam/`. `session.user.locale`
    // no existe todavía —Better Auth no declara ese campo adicional, y
    // tampoco hay uno equivalente en `users`—, así que la persona no aporta
    // fuente propia hoy; el criterio de prioridad (persona, escuela,
    // cabecera) es exactamente el que define `resolveLocale`.
    this.cls.set(
      CLS_LOCALE,
      resolveLocale({
        user: null,
        school: chosen.schoolLocale ?? null,
        header: header(request, "accept-language"),
      }),
    );

    return true;
  }
}

function header(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}
