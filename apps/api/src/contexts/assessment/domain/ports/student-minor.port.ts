import type { StudentId } from "../model/identifiers.js";

/**
 * Lo que Assessment necesita saber del alumnado, y nada más.
 *
 * Es un puerto de salida hacia `people`. Igual que `TeachesStudentPort`, no
 * importa el agregado `Student`: solo el único hecho que hace falta para
 * decidir la visibilidad de partida de una valoración — si el alumno es
 * menor de edad, ahora mismo.
 */
export interface StudentMinorPort {
  isMinor(studentId: StudentId): Promise<boolean>;

  /**
   * Si esta membresía es la titular de esta ficha, o su tutor legal (tarea
   * 16 de la ola 2: progreso del alumno — «el propio alumno, su tutor legal
   * si es menor», nunca el de otra familia aunque sea de la misma escuela).
   * Mismo criterio de acceso que `PortalReadModel.studentAccess` ya aplica
   * en `portal` (self o tutor), preguntado aquí con SQL propio porque un
   * contexto no importa el modelo de lectura de otro (`ARCHITECTURE.md`).
   */
  isSelfOrGuardian(params: { membershipId: string; studentId: StudentId }): Promise<boolean>;

  /**
   * Si esta ficha existe EN LA ESCUELA ACTIVA (tarea 16: `GetStudentProgress
   * Handler` la comprueba antes que cualquier rol, dirección incluida — sin
   * esto, un `studentId` de otra escuela no daba 404, sino un progreso vacío
   * con 200: ningún dato real cruzaba, pero tampoco se distinguía «no
   * existe» de «existe y no tienes nada que ver todavía»). RLS ya decide qué
   * existe; esto solo pregunta.
   */
  exists(studentId: StudentId): Promise<boolean>;
}

export const STUDENT_MINOR_PORT = Symbol("StudentMinorPort");
