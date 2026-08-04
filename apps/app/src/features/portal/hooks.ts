import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import type { SchoolTimezone } from "@langopia/contracts";
import { getMyStudents, getSchoolTimezone } from "./api.js";
import type { PortalStudentOption } from "./types.js";

/**
 * Consultas compartidas por las tres pantallas del portal (`/mi/clases`,
 * `/mi/facturas`, `/mi/asistencia`): la lista de alumnos elegibles (Paso 2) y
 * la zona horaria de la escuela (para pintar cada fecha en la zona de la
 * escuela, nunca la del navegador). Extraídas aquí en vez de repetidas tres
 * veces: misma clave de caché, mismo comportamiento en las tres.
 */

export const PORTAL_STUDENTS_QUERY_KEY = ["portal", "students"] as const;
export const PORTAL_TIMEZONE_QUERY_KEY = ["portal", "school-timezone"] as const;

export function useMyStudentsQuery(): UseQueryResult<PortalStudentOption[]> {
  return useQuery({ queryKey: PORTAL_STUDENTS_QUERY_KEY, queryFn: getMyStudents, staleTime: 60_000 });
}

export function useSchoolTimezoneQuery(): UseQueryResult<SchoolTimezone> {
  return useQuery({ queryKey: PORTAL_TIMEZONE_QUERY_KEY, queryFn: getSchoolTimezone, staleTime: 60_000 });
}
