import type { StudentId } from "../model/identifiers.js";

/**
 * Lo que Catalog necesita saber del alumnado, y nada más.
 *
 * Es un puerto de salida hacia OTRO contexto (Personas). Está declarado aquí,
 * en el lenguaje de este contexto, y no importa nada del dominio ajeno
 * (`ARCHITECTURE.md`): no se pregunta por el agregado `Student`, solo por el
 * único hecho que le hace falta a una matrícula.
 *
 * La implementación vive en `infrastructure/acl/` y es una capa
 * anticorrupción: traduce del modelo de Personas a esta única pregunta.
 */
export interface StudentStatusPort {
  /** ¿Existe y sigue activo (no de baja) en esta escuela? */
  isActive(studentId: StudentId): Promise<boolean>;
}

export const STUDENT_STATUS_PORT = Symbol("StudentStatusPort");
