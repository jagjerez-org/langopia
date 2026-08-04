import type {
  AgendaEntry,
  CancellationPreview,
  GroupRosterMember,
  SchoolTimezone,
} from "@langopia/contracts";
import { api } from "../../lib/api-client.js";

/**
 * Cliente HTTP del calendario (Tarea 9), sobre el cliente compartido
 * (`apps/app/src/lib/api-client.ts`, Tarea 2): mismo manejo de `code` de
 * error, misma cabecera `Accept-Language`, misma cabecera `x-school-slug`.
 *
 * `getSchoolTimezone`, `getGroupRoster` y `getCancellationPreview` consumen
 * tres endpoints que esta misma tarea añadió a `SchedulingController`
 * (`GET /scheduling/school-timezone`, `GET /scheduling/groups/:id/roster`,
 * `GET /scheduling/sessions/:id/cancellation-preview`): ninguno existía
 * antes de esta tarea. El motivo de cada uno está documentado en el
 * controlador y en el informe de esta tarea — en resumen, sin ellos el panel
 * tendría que adivinar la zona horaria de la escuela, inventarse el padrón
 * de un grupo, o decidir por su cuenta si una cancelación da derecho a
 * devolución, las tres cosas que `OLA-1-WEB.md` prohíbe.
 */

export function getAgenda(params: { from: string; to: string }): Promise<AgendaEntry[]> {
  const query = new URLSearchParams({ from: params.from, to: params.to });
  return api.get<AgendaEntry[]>(`/scheduling/agenda?${query.toString()}`);
}

export function getSchoolTimezone(): Promise<SchoolTimezone> {
  return api.get<SchoolTimezone>("/scheduling/school-timezone");
}

export function getGroupRoster(groupId: string): Promise<GroupRosterMember[]> {
  return api.get<GroupRosterMember[]>(`/scheduling/groups/${groupId}/roster`);
}

export function getCancellationPreview(
  sessionId: string,
  party: "school" | "student",
): Promise<CancellationPreview> {
  return api.get<CancellationPreview>(
    `/scheduling/sessions/${sessionId}/cancellation-preview?party=${party}`,
  );
}

export type ScheduleSessionInput = {
  groupId: string;
  teacherId?: string | null;
  startsAt: string;
  durationMinutes: number;
  roomProvider: string;
  roomUrl?: string | null;
  roomExternalId?: string | null;
  topic?: string | null;
};

export function scheduleSession(input: ScheduleSessionInput): Promise<{ sessionId: string }> {
  return api.post<{ sessionId: string }>("/scheduling/sessions", input);
}

export function cancelSession(
  sessionId: string,
  input: { party: "school" | "student"; reason: string },
): Promise<{ sessionId: string; refundDue: boolean; noticeHours: number }> {
  return api.post(`/scheduling/sessions/${sessionId}/cancel`, input);
}

export type RescheduleSessionInput = {
  newStartsAt: string;
  reason: string;
  newTeacherId?: string | null;
};

export function rescheduleSession(
  sessionId: string,
  input: RescheduleSessionInput,
): Promise<{ originalSessionId: string; replacementSessionId: string }> {
  return api.post(`/scheduling/sessions/${sessionId}/reschedule`, input);
}

export type AttendanceEntryInput = {
  studentId: string;
  status: "present" | "absent";
  note?: string | null;
};

export function recordAttendance(
  sessionId: string,
  entries: AttendanceEntryInput[],
): Promise<{ sessionId: string; recorded: number }> {
  return api.post(`/scheduling/sessions/${sessionId}/attendance`, { entries });
}
