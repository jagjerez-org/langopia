import type { SchoolTimezone } from "@langopia/contracts";
import { api } from "../../lib/api-client.js";
import type {
  DueCard,
  ExerciseToDo,
  PendingAttemptEntry,
  ReturnAttemptInput,
  SubmitAttemptInput,
  SubmitAttemptResult,
  ValidateAttemptInput,
} from "./types.js";

/**
 * Cliente HTTP de «hacer ejercicios» (Tarea 12 de la ola 2), sobre el cliente
 * compartido (`apps/app/src/lib/api-client.ts`): mismo manejo de errores
 * tipados, misma cabecera `Accept-Language`, misma `x-school-slug`.
 *
 * Sin lógica propia: cada función traduce uno a uno un endpoint. QUIÉN puede
 * ver o enviar qué lo deciden los manejadores de la API (dirección ve
 * cualquier alumno; un profesor, el suyo; el alumno o su tutor, solo lo
 * propio — 403 `attempt_access_denied` / `due_cards_access_denied` si no), y
 * este fichero no repite ninguna de esas comprobaciones.
 */

/** Ejercicios publicados a los grupos activos del alumno, con su último intento si lo hay. */
export function listExercisesToDo(studentId: string): Promise<ExerciseToDo[]> {
  return api.get<ExerciseToDo[]>(`/assessments/students/${studentId}/exercises`);
}

export function submitAttempt(input: SubmitAttemptInput): Promise<SubmitAttemptResult> {
  return api.post<SubmitAttemptResult>("/assessments/attempts", input);
}

/** Bandeja del profesor: intentos que siguen esperando su firma, el más antiguo primero. */
export function listPendingAttempts(): Promise<PendingAttemptEntry[]> {
  return api.get<PendingAttemptEntry[]>("/assessments/attempts/pending");
}

export function validateAttempt(attemptId: string, input: ValidateAttemptInput): Promise<unknown> {
  return api.post<unknown>(`/assessments/attempts/${attemptId}/validate`, input);
}

export function returnAttempt(attemptId: string, input: ReturnAttemptInput): Promise<unknown> {
  return api.post<unknown>(`/assessments/attempts/${attemptId}/return`, input);
}

/**
 * Tarjetas de repaso vencidas de hoy. «Hoy» lo resuelve el servidor en la
 * zona horaria de la ESCUELA (`SchoolCalendarPort`), no el navegador: este
 * cliente no calcula ninguna fecha.
 */
export function listDueCards(studentId: string): Promise<DueCard[]> {
  return api.get<DueCard[]>(`/learning/students/${studentId}/due-cards`);
}

/**
 * Zona horaria de la escuela (`GET /scheduling/school-timezone`, Tarea 9 del
 * panel): las fechas de la bandeja y del repaso se pintan en la zona de la
 * ESCUELA, nunca en la del navegador de quien mira la pantalla.
 */
export function getSchoolTimezone(): Promise<SchoolTimezone> {
  return api.get<SchoolTimezone>("/scheduling/school-timezone");
}
