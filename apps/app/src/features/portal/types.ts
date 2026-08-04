/**
 * Tipos del cliente para la Tarea 11 (Portal del alumno), sobre los
 * endpoints de `portal` (`/portal/me/*`, ya construidos y auditados en la
 * API) y el de zona horaria de `scheduling` (`/scheduling/school-timezone`,
 * abierto a estos dos roles por esta misma tarea).
 */

/** Fila de `GET /portal/me/students` (Paso 2: el selector de "cambiar de hijo"). */
export type PortalStudentOption = {
  studentId: string;
  name: string;
};

/** Fila de `GET /portal/me/sessions`. */
export type PortalSessionEntry = {
  sessionId: string;
  groupName: string;
  courseCode: string;
  teacherName: string | null;
  start: string;
  end: string;
  status: string;
  roomProvider: string;
  roomUrl: string | null;
  topic: string | null;
};

/** Fila de `GET /portal/me/attendance`. */
export type PortalAttendanceEntry = {
  sessionId: string;
  groupName: string;
  start: string;
  status: string;
};

/** Fila de `GET /portal/me/invoices`. */
export type PortalInvoiceEntry = {
  invoiceId: string;
  number: string;
  status: string;
  totalCents: number;
  currency: string;
  issuedOn: string | null;
  dueOn: string | null;
  paidAt: string | null;
};
