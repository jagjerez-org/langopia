import { SetMetadata } from "@nestjs/common";
import type { ForbiddenImpersonationAction } from "../../../iam/domain/model/impersonation-rules.js";

export const ROLES_KEY = "langopia:roles";
export const PUBLIC_KEY = "langopia:public";
export const IMPERSONATION_RESTRICTED_KEY = "langopia:impersonation_restricted";

/** Restringe el endpoint a los roles indicados dentro de la escuela activa. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/** Marca el endpoint como accesible sin sesión. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/**
 * Marca un endpoint como prohibido mientras se impersona (Tarea 17, `iam`).
 *
 * `AuthenticatedGuard` lo comprueba junto al rol: si la petición ocurre
 * dentro de una impersonación activa, rechaza con `403
 * impersonation_forbidden_action` antes de que el controlador vea nada. El
 * valor viene siempre de `FORBIDDEN_WHILE_IMPERSONATING`
 * (`contexts/iam/domain/model/impersonation-rules.ts`) — la lista cerrada
 * vive en el dominio de `iam`, no aquí; este fichero solo declara la
 * metadata, igual que ya hace con `Roles`.
 *
 * El parámetro era `string`, y eso convertía la lista cerrada en una
 * promesa que no se cumplía: `@RestrictedWhileImpersonating("paymnet_operation")`
 * compilaba, se anotaba y desactivaba la restricción en silencio —el guardia
 * comparaba contra un valor que no reconoce nadie— justo en los endpoints
 * que más falta hace que la lleven. Los cuatro controladores que la usan
 * escriben la cadena a mano, así que la errata era cuestión de tiempo.
 *
 * Ahora el tipo viene de la propia lista, con `import type`: se borra al
 * compilar, así que `shared` no depende de `iam` en tiempo de ejecución ni se
 * crea ciclo alguno — lo único que cruza es la forma, que es exactamente el
 * contrato que el comentario anterior ya decía tener. `AuthenticatedGuard`
 * además vuelve a comprobarlo contra la lista de verdad, para que un `as`
 * tampoco lo cuele.
 */
export const RestrictedWhileImpersonating = (action: ForbiddenImpersonationAction) =>
  SetMetadata(IMPERSONATION_RESTRICTED_KEY, action);
