import { DomainError } from "../../../shared/domain/errors/domain-error.js";

/**
 * La membresía pedida existe en esta escuela (RLS ya la deja ver), pero quien
 * pregunta no es ella misma, ni su tutor legal si es menor, ni dirige la
 * escuela.
 *
 * Mismo criterio que `PortalAccessDeniedError`: RLS ya decidió qué existe,
 * esto decide de quién son los datos. Cubre también el caso explícito del
 * brief — un alumno menor de edad no puede ejercer el derecho de acceso o
 * borrado sobre sí mismo: tiene que hacerlo su tutor, o la dirección.
 */
export class PersonalDataAccessDeniedError extends DomainError {
  readonly code = "personal_data_access_denied";
  readonly kind = "forbidden" as const;

  constructor(membershipId: string) {
    super(
      "No puedes acceder a los datos personales de otra persona: solo puede pedirlos ella misma " +
        "(si es mayor de edad), su tutor legal si es menor, o la dirección de la escuela.",
      { membershipId },
    );
  }
}

/**
 * Ya se pseudonimizó esta persona. Un borrado es irreversible por diseño
 * (`docs/RGPD.md`): repetirlo no deshace nada ni tiene ningún efecto nuevo
 * que auditar, así que se rechaza en vez de escribir una segunda vez el mismo
 * marcador y ensuciar `audit_logs` con un borrado que ya ocurrió.
 */
export class PersonAlreadyErasedError extends DomainError {
  readonly code = "person_already_erased";
  readonly kind = "conflict" as const;

  constructor(membershipId: string) {
    super("Los datos personales de esta persona ya se borraron.", { membershipId });
  }
}

/**
 * La persona tiene otra membresía activa en otra escuela: el mismo `users.id`
 * es compartido (misma persona, dos academias — un profesor que da clase en
 * dos escuelas es el caso real del seed). `users.name`/`users.email` son
 * GLOBALES, no de esta escuela: pseudonimizarlos aquí le borraría el nombre
 * también a la otra escuela, que no ha pedido nada.
 *
 * Se rechaza el borrado entero en vez de hacerlo a medias — un borrado mal
 * acotado es irreversible y esto sería exactamente eso: irreversible Y mal
 * acotado. Resolverlo de verdad pide un nombre por membresía, que no entra en
 * el alcance de esta tarea (no toca el esquema).
 */
export class PersonHasOtherSchoolMembershipsError extends DomainError {
  readonly code = "person_has_other_school_memberships";
  readonly kind = "invariant_violation" as const;

  constructor(membershipId: string) {
    super(
      "Esta persona tiene una membresía activa en otra escuela: borrar su nombre y correo aquí " +
        "los borraría también allí. No se puede completar el borrado sin acuerdo con la otra escuela.",
      { membershipId },
    );
  }
}
