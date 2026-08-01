import type { SchoolTimezone } from "@langopia/contracts";
import { api } from "../../lib/api-client.js";
import type {
  PortalAttendanceEntry,
  PortalInvoiceEntry,
  PortalSessionEntry,
  PortalStudentOption,
} from "./types.js";

/**
 * Cliente HTTP del portal del alumno (Tarea 11), sobre el cliente compartido
 * (`apps/web/src/lib/api-client.ts`): mismo manejo de errores tipados, misma
 * cabecera `Accept-Language`.
 *
 * Los tres endpoints de datos aceptan un `studentId` opcional (`student_
 * profiles.id`, no el de membresía): sin él, la API resuelve al alumno
 * propio de la sesión; con él, sirve para que un tutor con varios hijos
 * elija cuál — y para que la API rechace con 403 `portal_access_denied` un
 * intento de ver el de otro alumno que no es tutelado. Esa comprobación es
 * enteramente del servidor (`resolvePortalStudentId`, API): este cliente solo
 * transporta el parámetro, nunca decide a quién pertenece cada respuesta.
 */

function query(studentId: string | undefined): string {
  return studentId ? `?studentId=${encodeURIComponent(studentId)}` : "";
}

/** Los alumnos que esta membresía puede elegir: ella misma, o todos sus tutelados. */
export function getMyStudents(): Promise<PortalStudentOption[]> {
  return api.get<PortalStudentOption[]>("/portal/me/students");
}

export function getMySessions(studentId?: string): Promise<PortalSessionEntry[]> {
  return api.get<PortalSessionEntry[]>(`/portal/me/sessions${query(studentId)}`);
}

export function getMyAttendance(studentId?: string): Promise<PortalAttendanceEntry[]> {
  return api.get<PortalAttendanceEntry[]>(`/portal/me/attendance${query(studentId)}`);
}

export function getMyInvoices(studentId?: string): Promise<PortalInvoiceEntry[]> {
  return api.get<PortalInvoiceEntry[]>(`/portal/me/invoices${query(studentId)}`);
}

/**
 * Zona horaria de la escuela (`GET /scheduling/school-timezone`, Tarea 9 del
 * panel; abierto a `student`/`guardian` por esta misma tarea): las tres
 * pantallas del portal muestran fechas en la zona de LA ESCUELA, nunca la del
 * navegador, igual que el calendario.
 */
export function getSchoolTimezone(): Promise<SchoolTimezone> {
  return api.get<SchoolTimezone>("/scheduling/school-timezone");
}
