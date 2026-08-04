import { api } from "../../lib/api-client.js";
import type {
  EnrolStudentInput,
  EnrolStudentResult,
  EvaluateStudentInput,
  EvaluateStudentResult,
  ImportReport,
  LeaveStudentResult,
  PersonalDataExport,
  StudentListItem,
  StudentProgress,
  StudentWithoutEvaluation,
  UpdateStudentInput,
  UpdateStudentResult,
} from "./types.js";

/**
 * Cliente HTTP de la Tarea 7 (Alumnado), sobre el cliente compartido
 * (`apps/app/src/lib/api-client.ts`): mismo manejo de errores tipados, misma
 * cabecera `Accept-Language`, misma redirección en `missing_tenant`.
 *
 * Sin lógica propia: cada función traduce uno a uno los endpoints ya
 * construidos y verificados de `people` (tareas 2, 13, 14), `iam` (tarea 15,
 * RGPD) y `assessment` (tarea 16) — nada que decidir aquí.
 */

export function listStudents(): Promise<StudentListItem[]> {
  return api.get<StudentListItem[]>("/students");
}

export function enrolStudent(input: EnrolStudentInput): Promise<EnrolStudentResult> {
  return api.post<EnrolStudentResult>("/students", input);
}

export function updateStudent(
  studentId: string,
  input: UpdateStudentInput,
): Promise<UpdateStudentResult> {
  return api.patch<UpdateStudentResult>(`/students/${studentId}`, input);
}

export function leaveStudent(studentId: string, reason: string): Promise<LeaveStudentResult> {
  return api.post<LeaveStudentResult>(`/students/${studentId}/leave`, { reason });
}

/** Previsualiza una importación (Tarea 14): no escribe nada. */
export function previewStudentsImport(csv: string): Promise<ImportReport> {
  return api.post<ImportReport>("/students/import/preview", { csv });
}

/** Confirma la importación: da de alta o pone al día cada fila válida. */
export function commitStudentsImport(csv: string): Promise<ImportReport> {
  return api.post<ImportReport>("/students/import/commit", { csv });
}

/**
 * Derecho de acceso y portabilidad (Tarea 15, RGPD): de aquí salen las
 * pestañas de asistencia, consentimientos, facturas y valoraciones de la
 * ficha, sin duplicar ningún modelo de lectura ya construido. Se pide por
 * `membershipId` (no `studentId`) — ver la nota en `StudentListItem`.
 */
export function exportPersonalData(membershipId: string): Promise<PersonalDataExport> {
  return api.get<PersonalDataExport>(`/people/${membershipId}/export`);
}

export function evaluateStudent(input: EvaluateStudentInput): Promise<EvaluateStudentResult> {
  return api.post<EvaluateStudentResult>("/assessments/evaluations", input);
}

/** Alumnado sin una valoración de progreso en las últimas `weeks` semanas (3 por defecto en la API). */
export function getStudentsWithoutEvaluation(weeks?: number): Promise<StudentWithoutEvaluation[]> {
  const query = weeks !== undefined ? `?weeks=${weeks}` : "";
  return api.get<StudentWithoutEvaluation[]>(`/assessments/students-without-evaluation${query}`);
}

/**
 * Progreso del alumno (Tarea 16 de la ola 2): mismo endpoint para la ficha
 * del alumno y para el portal (`PortalProgressScreen`, que resuelve el
 * `studentId` con `GET /portal/me/students`, ya construido en la Tarea 11,
 * antes de llamar aquí) — quién puede verlo lo decide la API
 * (`StudentProgressController`, `GetStudentProgressHandler`), nunca esta
 * función.
 */
export function getStudentProgress(studentId: string): Promise<StudentProgress> {
  return api.get<StudentProgress>(`/assessments/students/${studentId}/progress`);
}
