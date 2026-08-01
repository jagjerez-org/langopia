import { Uuid } from "./uuid.js";

/**
 * Identificador de escuela. Transversal a todos los contextos: es la frontera
 * del tenant, no un concepto de ninguno de ellos en particular.
 */
export class SchoolId extends Uuid {
  private constructor(value: string) {
    super(value, "escuela");
  }

  static of(value: string): SchoolId {
    return new SchoolId(value);
  }
}

/** Identificador de una membresía: quién es alguien DENTRO de una escuela. */
export class MembershipId extends Uuid {
  private constructor(value: string) {
    super(value, "membresía");
  }

  static of(value: string): MembershipId {
    return new MembershipId(value);
  }
}
