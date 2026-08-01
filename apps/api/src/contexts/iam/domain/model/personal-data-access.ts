/**
 * Quién puede ejercer el derecho de acceso o de borrado sobre los datos de
 * una membresía concreta (Tarea 15, RGPD).
 *
 * Regla, verbatim del brief: «Lo puede pedir la propia persona, su tutor si
 * es menor, o la dirección.» Es una función pura y sin I/O a propósito: el
 * único dato que necesita de fuera (si el objetivo es menor y quiénes son sus
 * tutores) ya lo trae `PersonAccessContext`, que resuelve el modelo de
 * lectura antes de llamar aquí.
 *
 * El caso importante es el que un `if` normal olvidaría: un alumno menor
 * pidiendo SUS PROPIOS datos. `requesterMembershipId === target.membershipId`
 * sería cierto, pero como `target.isMinor` también lo es, la rama de abajo
 * exige además ser uno de sus tutores — y el propio menor nunca está en esa
 * lista. Así el menor queda bloqueado sin necesitar un caso aparte: es
 * consecuencia de la misma regla, no una excepción a ella.
 */
export type PersonAccessContext = {
  membershipId: string;
  isMinor: boolean;
  /** Membresías con derecho a actuar como tutor de `membershipId`, si es menor. */
  guardianMembershipIds: readonly string[];
};

export function canAccessPersonalData(params: {
  requesterMembershipId: string;
  requesterRoles: readonly string[];
  target: PersonAccessContext;
}): boolean {
  if (params.requesterRoles.includes("owner") || params.requesterRoles.includes("admin")) {
    return true;
  }
  if (params.target.isMinor) {
    return params.target.guardianMembershipIds.includes(params.requesterMembershipId);
  }
  return params.requesterMembershipId === params.target.membershipId;
}
