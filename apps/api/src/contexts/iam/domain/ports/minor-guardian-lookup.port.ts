/** Si la membresía a la que apunta la impersonación es la de un alumno menor, y quién es su tutor. */
export type MinorGuardianContext = {
  isMinor: boolean;
  /** Membresías de los tutores legales. Vacío si no aplica o si el alumno no es menor. */
  guardianMembershipIds: string[];
};

/**
 * Capa anticorrupción hacia `people`: lee `student_profiles` y `guardians`
 * —tablas ajenas a `iam`— igual que `notifications` cruza esas mismas
 * tablas desde fuera de `people` (`DrizzlePeopleDirectoryRepository`). Sin
 * ella, «actuar como un menor se marca aparte» (brief de la tarea) obligaría
 * a `iam` a conocer el agregado `Student`.
 */
export interface MinorGuardianLookupPort {
  /** Nunca lanza: una membresía que no es de alumno simplemente no es menor. */
  contextFor(membershipId: string): Promise<MinorGuardianContext>;
}

export const MINOR_GUARDIAN_LOOKUP = Symbol("MinorGuardianLookupPort");
