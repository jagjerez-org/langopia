/**
 * Identificadores de todas las escuelas.
 *
 * Excepción acotada a «todo acceso a datos va dentro de uow.execute()»,
 * igual que `MembershipLookupPort` en `iam` y por el mismo motivo: la purga
 * corre fuera de una petición HTTP, así que no hay ninguna sesión que
 * resuelva un tenant. Antes de poder fijar el primer `app.school_id` hace
 * falta saber por cuáles escuelas empezar, y esa pregunta no se puede
 * responder con el tenant ya fijado.
 *
 * Devuelve solo el `id` —nada de NIF, referencia de cobro ni ninguna otra
 * columna de `schools`— y no se reutiliza para nada más que arrancar un
 * trabajo de sistema. Ver `ARCHITECTURE.md` para la justificación completa.
 */
export interface SchoolDirectoryPort {
  allIds(): Promise<string[]>;
}

export const SCHOOL_DIRECTORY = Symbol("SchoolDirectoryPort");
