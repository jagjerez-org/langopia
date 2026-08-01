import { Injectable } from "@nestjs/common";
import type { GroupId, StudentId } from "../../domain/model/identifiers.js";
import type { GroupEnrollmentPort } from "../../domain/ports/group-enrollment.port.js";
import { DrizzleGroupEnrollmentRepository } from "../persistence/drizzle-group-enrollment.repository.js";

/**
 * Capa anticorrupción hacia el contexto de Catálogo.
 *
 * Scheduling necesita un único dato de las matrículas —quién sigue activo en
 * el grupo, ahora mismo— y no debe saber nada más: ni de `Group`, ni de
 * `Enrollment`, ni de su ciclo de vida. El acceso a datos vive en
 * `DrizzleGroupEnrollmentRepository` (`infrastructure/persistence/`): este
 * adaptador delega, no escribe SQL.
 */
@Injectable()
export class CatalogGroupEnrollmentAdapter implements GroupEnrollmentPort {
  constructor(private readonly repository: DrizzleGroupEnrollmentRepository) {}

  activeStudentIds(groupId: GroupId): Promise<StudentId[]> {
    return this.repository.activeStudentIds(groupId);
  }
}
