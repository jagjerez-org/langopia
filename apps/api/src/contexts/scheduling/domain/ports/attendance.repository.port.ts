import type { AttendanceEntry } from "../model/attendance-entry.entity.js";
import type { AttendanceSheet } from "../model/attendance.aggregate.js";
import type { SessionId } from "../model/identifiers.js";

/**
 * Repositorio de la hoja de asistencia.
 *
 * No hay una fila «hoja»: persiste las entradas (`attendance`) que componen
 * el agregado `AttendanceSheet`. `findEntries` es deliberadamente ajeno al
 * padrón de matriculados — ese dato es de `catalog` y lo trae
 * `GroupEnrollmentPort`, no este repositorio.
 */
export interface AttendanceRepository {
  /** Entradas ya guardadas para esta clase, para reconstruir la hoja. */
  findEntries(sessionId: SessionId): Promise<AttendanceEntry[]>;

  /** Guarda TODAS las entradas de la hoja (alta o corrección, en una sola pasada). */
  save(sheet: AttendanceSheet): Promise<void>;
}

export const ATTENDANCE_REPOSITORY = Symbol("AttendanceRepository");
