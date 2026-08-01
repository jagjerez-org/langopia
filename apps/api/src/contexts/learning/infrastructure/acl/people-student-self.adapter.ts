import { Injectable } from "@nestjs/common";
import type { StudentSelfPort } from "../../domain/ports/student-self.port.js";
import { DrizzleStudentSelfRepository } from "../persistence/drizzle-student-self.repository.js";

/**
 * Capa anticorrupción hacia el contexto de Personas.
 *
 * `learning` necesita un único dato de `people` —si esta membresía es el
 * alumno o su tutor legal— y no debe saber nada más. El acceso a datos vive
 * en `DrizzleStudentSelfRepository` (`infrastructure/persistence/`): este
 * adaptador delega, no escribe SQL.
 */
@Injectable()
export class PeopleStudentSelfAdapter implements StudentSelfPort {
  constructor(private readonly repository: DrizzleStudentSelfRepository) {}

  isSelfOrGuardian(membershipId: string, studentProfileId: string): Promise<boolean> {
    return this.repository.isSelfOrGuardian(membershipId, studentProfileId);
  }
}
