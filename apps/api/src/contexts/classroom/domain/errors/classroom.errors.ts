import { DomainError } from "../../../shared/domain/errors/domain-error.js";

export class InsufficientCreditsError extends DomainError {
  readonly code = "insufficient_credits";
  readonly kind = "invariant_violation" as const;

  constructor(schoolId: string, requestedCredits: number, availableCredits: number) {
    super("No hay créditos suficientes para generar contenido con IA.", {
      schoolId,
      requestedCredits,
      availableCredits,
    });
  }
}

export class InvalidCreditAmountError extends DomainError {
  readonly code = "invalid_credit_amount";
  readonly kind = "invalid_input" as const;

  constructor(credits: number) {
    super("La cantidad de créditos debe ser un entero positivo.", { credits });
  }
}

/**
 * La sala de la clase todavía no está lista para entrar.
 *
 * Dos motivos posibles, en `details.reason`: la clase es presencial y no
 * tiene ningún enlace al que unirse (`in_person`), o el proveedor necesita
 * OAuth de la escuela y todavía no está conectado (`pending_oauth`). El
 * mensaje no interpola `reason` a propósito: son dos frases distintas, no un
 * valor que encaje en una plantilla común (igual que `invalid_time_slot`).
 */
/**
 * Quien pide entrar no está matriculado en el grupo de esta clase.
 *
 * Saneamiento de cierre de la ola 1: hasta ahora cualquier alumno de la
 * escuela podía pedir el token de cualquier clase de la escuela. `forbidden`
 * y no `not_found`: la clase existe y quien pregunta pertenece a la escuela,
 * así que fingir que no existe no oculta nada que no sepa ya, y un 403 le
 * dice a la interfaz que el problema es la matrícula, no la URL.
 */
export class NotEnrolledInSessionError extends DomainError {
  readonly code = "not_enrolled_in_session";
  readonly kind = "forbidden" as const;

  constructor(sessionId: string) {
    super(`No estás matriculado en el grupo de la clase ${sessionId}.`, { sessionId });
  }
}

export class RoomNotReadyError extends DomainError {
  readonly code = "room_not_ready";
  readonly kind = "conflict" as const;

  constructor(sessionId: string, reason: string) {
    super(`La sala de la clase ${sessionId} todavía no está lista para entrar.`, {
      sessionId,
      reason,
    });
  }
}
