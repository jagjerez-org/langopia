import type { GroupId, StudentId } from "../model/identifiers.js";

/**
 * Lo que Scheduling necesita saber de las matrículas, y nada más.
 *
 * Es un puerto de salida hacia OTRO contexto (`catalog`). Está declarado
 * aquí, en el lenguaje de este contexto, y no importa nada del dominio ajeno:
 * ni `Group`, ni `Enrollment`, ni su repositorio. Solo la pregunta que hace
 * falta para validar y cerrar una hoja de asistencia — quién sigue
 * matriculado en el grupo de esta clase.
 *
 * La implementación vive en `infrastructure/acl/` y es una capa
 * anticorrupción: traduce del modelo de `catalog` a esta única pregunta.
 */
export interface GroupEnrollmentPort {
  /** Alumnado con matrícula activa en el grupo, ahora mismo. */
  activeStudentIds(groupId: GroupId): Promise<StudentId[]>;
}

export const GROUP_ENROLLMENT_PORT = Symbol("GroupEnrollmentPort");
