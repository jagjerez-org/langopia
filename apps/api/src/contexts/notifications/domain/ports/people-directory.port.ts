import type { GuardianCandidate, RecipientCandidate } from "../model/recipient.js";

/** Lo que hace falta de un alumno para decidir a quién y en qué idioma escribirle. */
export interface StudentRecipientContext {
  isMinor: boolean;
  student: RecipientCandidate;
  guardians: GuardianCandidate[];
}

/**
 * Capa anticorrupción hacia `people` y `iam` (memberships/users son de
 * tenancy, no de `people`, pero es el mismo cruce que ya hace
 * `DrizzlePeopleReadModel` dentro del propio `people`).
 *
 * Notifications no importa `Student`, `Guardian` ni ningún agregado ajeno:
 * solo estas dos preguntas, en primitivos.
 */
export interface PeopleDirectoryPort {
  /** `null` si el alumno no existe (dato inconsistente: el evento no debería haberlo citado). */
  findStudentRecipientContext(studentId: string): Promise<StudentRecipientContext | null>;

  /** Para avisos que ya traen una membresía resuelta (p. ej. quien paga una factura). */
  findMembershipRecipient(membershipId: string): Promise<RecipientCandidate | null>;
}

export const PEOPLE_DIRECTORY = Symbol("PeopleDirectoryPort");
