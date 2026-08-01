import { SingleValueObject } from "../../../shared/domain/primitives/value-object.js";
import { DomainError } from "../../../shared/domain/errors/domain-error.js";

/**
 * Mensaje fijo, sin marcadores, a propósito: las tres ramas (longitud,
 * caracteres, palabra reservada) son frases distintas y no encajan en una
 * única plantilla ICU. Mismo criterio que ya siguen `InvalidTimeSlotError` o
 * `InvalidRoomError` — el porqué exacto viaja en `details`, no en la
 * traducción.
 */
export class InvalidSchoolSlugError extends DomainError {
  readonly code = "invalid_school_slug";
  readonly kind = "invalid_input" as const;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, details);
  }
}

const MIN_LENGTH = 3;
const MAX_LENGTH = 40;
const SLUG_PATTERN = /^[a-z0-9-]+$/;

/**
 * Palabras que no pueden ser el identificador de una escuela: chocarían con
 * rutas propias de la plataforma o con el subdominio que usa cada una
 * (`<slug>.langopia.app`).
 */
const RESERVED_SLUGS: ReadonlySet<string> = new Set(["www", "api", "app", "admin", "mail", "static"]);

/**
 * Identificador público de una escuela: subdominio y clave de sus rutas.
 *
 * Único globalmente —lo impone `schools_slug_uq` en el esquema, no este
 * objeto de valor, que no puede consultar la base de datos—. Lo que sí puede
 * y debe comprobar por sí mismo es la FORMA: longitud, alfabeto y que no sea
 * una palabra reservada.
 */
export class SchoolSlug extends SingleValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static of(value: string): SchoolSlug {
    if (value.length < MIN_LENGTH || value.length > MAX_LENGTH) {
      throw new InvalidSchoolSlugError(
        `El identificador de escuela debe tener entre ${MIN_LENGTH} y ${MAX_LENGTH} caracteres.`,
        { value, length: value.length },
      );
    }
    if (!SLUG_PATTERN.test(value)) {
      throw new InvalidSchoolSlugError(
        "El identificador de escuela solo admite minúsculas, números y guiones.",
        { value },
      );
    }
    if (RESERVED_SLUGS.has(value)) {
      throw new InvalidSchoolSlugError(
        `«${value}» es una palabra reservada: no puede usarse como identificador de escuela.`,
        { value },
      );
    }
    return new SchoolSlug(value);
  }
}
