/**
 * Error de dominio.
 *
 * El dominio no sabe qué es un código HTTP. Lanza errores con un `code`
 * estable y un tipo; es un filtro de la capa de infraestructura quien decide
 * que `not_found` son 404 y `invariant_violation` son 409.
 */
export type DomainErrorKind =
  | "invalid_input" // el valor no puede existir: fecha imposible, nivel inventado
  | "invariant_violation" // el valor existe pero rompe una regla: solapar dos clases
  | "not_found"
  | "conflict" // choque de concurrencia o estado ya alcanzado
  | "forbidden"; // la acción no está permitida para quien la pide

export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly kind: DomainErrorKind;

  /** Datos para que el cliente pueda explicar el error sin parsear el texto. */
  readonly details: Record<string, unknown>;

  protected constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = new.target.name;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}

/** Se pidió algo que no existe en esta escuela. */
export class NotFoundError extends DomainError {
  readonly code = "not_found";
  readonly kind = "not_found" as const;

  constructor(resource: string, id: string) {
    super(`No existe ${resource} con id ${id} en esta escuela.`, { resource, id });
  }
}

/** Alguien intentó modificar algo que otro modificó antes. */
export class ConcurrencyError extends DomainError {
  readonly code = "concurrency_conflict";
  readonly kind = "conflict" as const;

  constructor(resource: string, id: string) {
    super(
      `${resource} ${id} ha cambiado desde que lo leíste. Vuelve a cargarlo e inténtalo de nuevo.`,
      { resource, id },
    );
  }
}
