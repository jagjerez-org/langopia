import { SingleValueObject } from "./value-object.js";
import { DomainError } from "../errors/domain-error.js";

export class InvalidUuidError extends DomainError {
  readonly code = "invalid_uuid";
  readonly kind = "invalid_input" as const;

  constructor(value: string, type: string) {
    super(`«${value}» no es un identificador válido de ${type}.`, { value, type });
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Identificador. Se extiende una vez por agregado para que el compilador
 * distinga un `SessionId` de un `StudentId`: pasar uno donde va el otro es
 * un error de tipos, no un fallo en producción a las tres de la mañana.
 */
export abstract class Uuid extends SingleValueObject<string> {
  protected constructor(value: string, typeName: string) {
    if (!UUID_PATTERN.test(value)) throw new InvalidUuidError(value, typeName);
    super(value.toLowerCase());
  }

  override equals(other?: Uuid): boolean {
    if (other === null || other === undefined) return false;
    if (other.constructor !== this.constructor) return false;
    return this.value === other.value;
  }
}
