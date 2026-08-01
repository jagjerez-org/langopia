import type { TeacherId } from "../model/identifiers.js";
import type { TimeSlot } from "../model/time-slot.vo.js";

/**
 * Lo que Scheduling necesita saber del profesorado, y nada más.
 *
 * Es un puerto de salida hacia OTRO contexto (Personas). Está declarado aquí,
 * en el lenguaje de este contexto, y no importa nada del dominio ajeno: eso
 * es lo que impide que un cambio en la ficha del profesor se propague hasta
 * el calendario.
 *
 * La implementación vive en `infrastructure/acl/` y es una capa
 * anticorrupción: traduce del modelo de Personas a estos tres datos.
 */
export interface TeacherAvailabilityPort {
  /** ¿Existe y sigue activo en esta escuela? */
  isActive(teacherId: TeacherId): Promise<boolean>;

  /** ¿Declaró disponibilidad que cubra esta franja? */
  coversSlot(teacherId: TeacherId, slot: TimeSlot): Promise<boolean>;

  /** Horas semanales contratadas. Denominador de la ocupación. */
  contractedHoursPerWeek(teacherId: TeacherId): Promise<number | null>;
}

export const TEACHER_AVAILABILITY_PORT = Symbol("TeacherAvailabilityPort");
