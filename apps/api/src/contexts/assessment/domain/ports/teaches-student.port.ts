import type { StudentId, TeacherId } from "../model/identifiers.js";

/**
 * Lo que Assessment necesita saber de Scheduling, y nada más.
 *
 * Es un puerto de salida hacia OTRO contexto. Está declarado aquí, en el
 * lenguaje de este contexto, y no importa nada del dominio ajeno: ni
 * `ClassSession`, ni `AttendanceSheet`, ni su repositorio. Solo la pregunta
 * que hace falta para decidir si un profesor puede valorar a un alumno — si
 * de verdad le impartió clase en ese periodo.
 *
 * La implementación vive en `infrastructure/acl/` y es una capa
 * anticorrupción: traduce del modelo de `scheduling` a esta única pregunta.
 */
export interface TeachesStudentPort {
  /** Si este profesor impartió clase a este alumno en algún momento del periodo. */
  taught(params: {
    teacherId: TeacherId;
    studentId: StudentId;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<boolean>;

  /**
   * Si la membresía que pregunta (no un `TeacherId`: quien pide su propio
   * progreso de un alumno lo hace desde su sesión, sin mandar su propio
   * identificador) ha dado clase alguna vez a este alumno.
   *
   * Tarea 16 de la ola 2 (progreso del alumno): mismo criterio que `taught`
   * —una fila de asistencia es la prueba de que la clase ocurrió—, pero sin
   * acotar a un periodo: ver la ficha de progreso no es un hecho fechado
   * como una valoración, así que «alguna vez» basta para decidir si es SU
   * profesor.
   */
  teachesStudent(params: { membershipId: string; studentId: StudentId }): Promise<boolean>;
}

export const TEACHES_STUDENT_PORT = Symbol("TeachesStudentPort");
