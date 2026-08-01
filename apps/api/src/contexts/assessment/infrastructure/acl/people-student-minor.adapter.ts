import { Injectable } from "@nestjs/common";
import type { StudentId } from "../../domain/model/identifiers.js";
import type { StudentMinorPort } from "../../domain/ports/student-minor.port.js";
import { DrizzleStudentMinorRepository } from "../persistence/drizzle-student-minor.repository.js";

/**
 * Capa anticorrupción hacia el contexto de Personas.
 *
 * Assessment necesita un único dato del alumnado —si es menor de edad— y no
 * debe saber nada más. El acceso a datos vive en
 * `DrizzleStudentMinorRepository` (`infrastructure/persistence/`): este
 * adaptador delega, no escribe SQL.
 */
@Injectable()
export class PeopleStudentMinorAdapter implements StudentMinorPort {
  constructor(private readonly repository: DrizzleStudentMinorRepository) {}

  isMinor(studentId: StudentId): Promise<boolean> {
    return this.repository.isMinor(studentId);
  }

  isSelfOrGuardian(params: { membershipId: string; studentId: StudentId }): Promise<boolean> {
    return this.repository.isSelfOrGuardian(params);
  }

  exists(studentId: StudentId): Promise<boolean> {
    return this.repository.exists(studentId);
  }
}
