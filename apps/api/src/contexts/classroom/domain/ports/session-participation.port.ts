/**
 * Si quien pide entrar a una clase tiene algo que hacer en ella.
 *
 * Saneamiento de cierre de la ola 1: `JoinClassroomSessionHandler` solo
 * comprobaba el rol, así que cualquier alumno de la escuela podía pedir el
 * token de CUALQUIER clase de la escuela —RLS aísla escuelas, no personas
 * dentro de una escuela— y colarse en el grupo de otro. Este puerto responde
 * la única pregunta que faltaba.
 *
 * Vive en `classroom` y lee tablas de `catalog` y `people` (`enrollments`,
 * `student_profiles`, `guardians`), igual que `SessionRoomPort` ya lee
 * `sessions`, de `scheduling`: cruzar la frontera importando el repositorio
 * ajeno invertiría la dependencia; un puerto propio con su adaptador propio,
 * no.
 */
export interface SessionParticipationPort {
  /**
   * ¿Esta membresía está matriculada —o es tutora de quien lo está— en el
   * grupo de esta clase?
   *
   * Solo cuenta la matrícula `active`: una baja del grupo deja de dar acceso
   * a las clases que quedan, que es justo lo que significa darse de baja.
   */
  isEnrolledInSessionGroup(sessionId: string, membershipId: string): Promise<boolean>;
}

export const SESSION_PARTICIPATION_PORT = Symbol("SessionParticipationPort");
