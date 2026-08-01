import type { GuardianCandidate, Recipient, RecipientCandidate } from "./recipient.js";

/**
 * Un alumno menor de edad sin ningún tutor legal registrado.
 *
 * No es una `DomainError` de las que traduce `messages.ts`: nunca llega a un
 * cliente HTTP, la lanza un manejador de eventos que la atrapa y la registra.
 * Tampoco debería poder ocurrir nunca —`people` exige tutor al matricular a
 * un menor (`GuardianRequiredError`)—, así que si esto salta es una señal de
 * datos inconsistentes, no un camino esperado.
 */
export class NoGuardianForMinorError extends Error {
  constructor(studentId: string) {
    super(
      `El alumno ${studentId} es menor de edad y no tiene ningún tutor legal registrado: ` +
        "no se envía el aviso a nadie.",
    );
    this.name = "NoGuardianForMinorError";
  }
}

/** `memberships.locale` manda; `users.locale` es el respaldo. */
function toRecipient(candidate: RecipientCandidate): Recipient {
  return {
    email: candidate.email,
    name: candidate.name,
    locale: candidate.membershipLocale ?? candidate.userLocale,
  };
}

/**
 * A quién escribir cuando el aviso es sobre un alumno, y en qué idioma.
 *
 * La regla que gobierna esto no es un detalle de plantilla: «los correos de
 * un menor van al tutor con `is_billing_contact`, nunca al alumno» (brief de
 * la tarea). Vive en el dominio y no en cada manejador de evento para que
 * ningún aviso nuevo pueda, por descuido, escribirle directamente a un menor.
 *
 * Si ningún tutor está marcado como contacto de facturación se usa el
 * primero disponible — más conservador que no enviar nada, y consistente con
 * que `guardianRequired` ya garantizó que existe al menos uno cuando el
 * alumno se matriculó.
 */
export function resolveStudentRecipient(params: {
  studentId: string;
  isMinor: boolean;
  student: RecipientCandidate;
  guardians: readonly GuardianCandidate[];
}): Recipient {
  if (!params.isMinor) return toRecipient(params.student);

  const billingGuardian =
    params.guardians.find((guardian) => guardian.isBillingContact) ?? params.guardians[0];
  if (!billingGuardian) throw new NoGuardianForMinorError(params.studentId);

  return toRecipient(billingGuardian);
}

/** A quién escribir cuando el aviso ya trae una membresía concreta (p. ej. `billToMembershipId`). */
export function resolveMembershipRecipient(candidate: RecipientCandidate): Recipient {
  return toRecipient(candidate);
}
