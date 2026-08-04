import { api } from "../../lib/api-client.js";
import type {
  HireTeacherInput,
  HireTeacherResult,
  ReleaseTeacherResult,
  SetAvailabilityInput,
  SetAvailabilityResult,
  TeacherListItem,
  UpdateTeacherInput,
  UpdateTeacherResult,
} from "./types.js";

/**
 * Cliente HTTP de la Tarea 8 (Profesorado), sobre el cliente compartido
 * (`apps/app/src/lib/api-client.ts`, Tarea 2): mismo manejo de errores
 * tipados, misma cabecera `Accept-Language`, misma redirección en
 * `missing_tenant`.
 *
 * Sin lógica propia: cada función traduce uno a uno los endpoints de
 * `people` — `listTeachers` es el único que esta tarea añadió a la API
 * (`GET /teachers`, ver el informe); el resto ya existía (Tareas 2 y 13).
 */

export function listTeachers(): Promise<TeacherListItem[]> {
  return api.get<TeacherListItem[]>("/teachers");
}

/** Alta de profesor (Tarea 13 del panel, hallazgo: ver el comentario de `HireTeacherInput`). */
export function hireTeacher(input: HireTeacherInput): Promise<HireTeacherResult> {
  return api.post<HireTeacherResult>("/teachers", input);
}

export function setTeacherAvailability(
  teacherId: string,
  input: SetAvailabilityInput,
): Promise<SetAvailabilityResult> {
  return api.put<SetAvailabilityResult>(`/teachers/${teacherId}/availability`, input);
}

export function updateTeacher(
  teacherId: string,
  input: UpdateTeacherInput,
): Promise<UpdateTeacherResult> {
  return api.patch<UpdateTeacherResult>(`/teachers/${teacherId}`, input);
}

export function releaseTeacher(teacherId: string, reason: string): Promise<ReleaseTeacherResult> {
  return api.post<ReleaseTeacherResult>(`/teachers/${teacherId}/release`, { reason });
}
