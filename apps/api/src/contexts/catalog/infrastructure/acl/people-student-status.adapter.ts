import { Injectable } from "@nestjs/common";
import type { StudentId } from "../../domain/model/identifiers.js";
import type { StudentStatusPort } from "../../domain/ports/student-status.port.js";
import { DrizzleStudentStatusRepository } from "../persistence/drizzle-student-status.repository.js";

/**
 * Capa anticorrupción hacia el contexto de Personas.
 *
 * Catalog necesita un único dato del alumnado —si sigue activo— y no debe
 * saber nada más. El acceso a datos vive en `DrizzleStudentStatusRepository`
 * (`infrastructure/persistence/`): este adaptador delega, no escribe SQL.
 */
@Injectable()
export class PeopleStudentStatusAdapter implements StudentStatusPort {
  constructor(private readonly repository: DrizzleStudentStatusRepository) {}

  isActive(studentId: StudentId): Promise<boolean> {
    return this.repository.isActive(studentId);
  }
}
