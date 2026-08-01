import { SingleValueObject } from "../../../shared/domain/primitives/value-object.js";
import { DomainError } from "../../../shared/domain/errors/domain-error.js";

export class InvalidDateOfBirthError extends DomainError {
  readonly code = "invalid_date_of_birth";
  readonly kind = "invalid_input" as const;
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, details);
  }
}

export const MAJORITY_AGE = 18;

/**
 * Fecha de nacimiento.
 *
 * La minoría de edad NO se guarda: se calcula. Guardarla como booleano
 * significaría que un alumno sigue siendo menor el día después de cumplir 18,
 * hasta que alguien se acuerde de actualizar la fila.
 */
export class DateOfBirth extends SingleValueObject<string> {
  private constructor(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new InvalidDateOfBirthError("La fecha de nacimiento debe tener formato AAAA-MM-DD.", {
        value,
      });
    }
    super(value);
  }

  static of(value: string): DateOfBirth {
    return new DateOfBirth(value);
  }

  ageAt(instant: Date): number {
    const nacimiento = new Date(`${this.value}T00:00:00Z`);
    if (nacimiento > instant) {
      throw new InvalidDateOfBirthError("La fecha de nacimiento está en el futuro.", {
        value: this.value,
      });
    }
    let edad = instant.getUTCFullYear() - nacimiento.getUTCFullYear();
    const mes = instant.getUTCMonth() - nacimiento.getUTCMonth();
    if (mes < 0 || (mes === 0 && instant.getUTCDate() < nacimiento.getUTCDate())) edad--;
    if (edad > 120) {
      throw new InvalidDateOfBirthError("Esa edad no es plausible: revisa la fecha.", {
        value: this.value,
        edad,
      });
    }
    return edad;
  }

  isMinorAt(instant: Date): boolean {
    return this.ageAt(instant) < MAJORITY_AGE;
  }
}
