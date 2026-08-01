import { DomainError } from "../../../shared/domain/errors/domain-error.js";

/**
 * El alumno pedido existe en esta escuela (RLS ya lo deja ver), pero quien
 * pregunta no es él ni su tutor legal.
 *
 * Es `forbidden`, no `not_found`: la fila es visible para esta escuela, solo
 * que no es tuya. Mismo criterio que ya usa `ForbiddenRoleError` — RLS ya
 * decidió qué existe, esto decide de quién es.
 */
export class PortalAccessDeniedError extends DomainError {
  readonly code = "portal_access_denied";
  readonly kind = "forbidden" as const;

  constructor(studentId: string) {
    super("No puedes ver los datos de un alumno que no eres tú ni tutelas.", { studentId });
  }
}
