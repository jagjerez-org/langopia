import { DomainError } from "../../../shared/domain/errors/domain-error.js";

/**
 * Un grupo ya tiene tantas matrículas activas como su `capacity`.
 *
 * El mismo error cubre las dos ramas del brief: un grupo normal que se llena
 * y un curso privado (capacidad 1) al que se intenta matricular un segundo
 * alumno — es la misma regla con un número distinto, no dos reglas.
 */
export class GroupFullError extends DomainError {
  readonly code = "group_full";
  readonly kind = "invariant_violation" as const;

  constructor(groupId: string, capacity: number) {
    super(`El grupo ya tiene su capacidad completa (${capacity} alumnos).`, { groupId, capacity });
  }
}

/** Un alumno de baja no se puede matricular. Se comprueba vía `StudentStatusPort`. */
export class StudentNotActiveError extends DomainError {
  readonly code = "student_not_active";
  readonly kind = "invariant_violation" as const;

  constructor(studentId: string) {
    super("El alumno está de baja y no se puede matricular.", { studentId });
  }
}

/** El precio acordado puede ser menor que el de catálogo, nunca negativo. */
export class NegativeAgreedPriceError extends DomainError {
  readonly code = "negative_agreed_price";
  readonly kind = "invalid_input" as const;

  constructor(agreedPriceCents: number) {
    super("El precio acordado no puede ser negativo.", { agreedPriceCents });
  }
}

/** Un curso necesita su nombre al menos en el idioma por defecto de la escuela. */
export class MissingDefaultTranslationError extends DomainError {
  readonly code = "missing_default_translation";
  readonly kind = "invalid_input" as const;

  constructor(defaultLocale: string) {
    super(
      `Falta el nombre del curso en el idioma por defecto de la escuela (${defaultLocale}).`,
      { defaultLocale },
    );
  }
}

/** Un grupo solo se inicia una vez, desde `planned`. */
export class GroupAlreadyStartedError extends DomainError {
  readonly code = "group_already_started";
  readonly kind = "invariant_violation" as const;

  constructor(groupId: string, status: string) {
    super(`El grupo ya está en estado «${status}» y no se puede iniciar de nuevo.`, {
      groupId,
      status,
    });
  }
}
