/**
 * Modelo de lectura del portal.
 *
 * Alimenta los dos adaptadores de entrada de esta tarea: el panel de
 * dirección y el portal del alumno. Igual que `SchedulingReadModel` con la
 * ocupación del profesorado, cruza tablas de varios contextos —`people`,
 * `scheduling`, `billing` y `evaluations` (todavía sin contexto propio,
 * llega en la ola 2 con `assessment`)— con SQL directo en su propia capa de
 * infraestructura. No carga agregados ni aplica invariantes: es lectura
 * pura, y el aislamiento entre escuelas lo sigue dando RLS, no un `WHERE`
 * añadido aquí.
 */

export type AtRiskReason = "low_attendance" | "no_recent_evaluation";

export type AtRiskStudent = {
  studentId: string;
  name: string;
  /** 0 a 1, últimas cuatro semanas. `null` si no tuvo ninguna clase en el periodo. */
  attendanceRate: number | null;
  /** `null` si nunca se le ha hecho una valoración de progreso. */
  weeksSinceLastEvaluation: number | null;
  reasons: AtRiskReason[];
};

export type DashboardCoreMetrics = {
  activeStudents: number;
  /** 0 a 1, sobre toda la escuela, últimas cuatro semanas. */
  averageAttendanceRate: number;
  invoicedThisMonthCents: number;
  currency: string;
};

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

export type PortalAttendanceEntry = {
  sessionId: string;
  groupName: string;
  start: string;
  status: string;
};

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

/** Resultado de comprobar si una membresía puede actuar como un alumno concreto. */
export type StudentAccess =
  | { kind: "not_found" }
  | { kind: "denied" }
  | { kind: "allowed"; studentId: string };

/** Un alumno por el que una membresía puede navegar en el portal (ella misma, o un tutelado). */
export type PortalStudentOption = {
  studentId: string;
  name: string;
};

export interface PortalReadModel {
  /** Sin las `reasons`: las decide el manejador, sobre estos mismos números. */
  studentsAtRisk(params: {
    attendanceFrom: Date;
    attendanceTo: Date;
    now: Date;
  }): Promise<Array<Omit<AtRiskStudent, "reasons">>>;

  coreMetrics(params: {
    attendanceFrom: Date;
    attendanceTo: Date;
    invoicedFrom: Date;
    invoicedTo: Date;
  }): Promise<DashboardCoreMetrics>;

  /** El alumno «propio» de esta membresía: ella misma, o su primer tutelado. */
  ownStudentId(membershipId: string): Promise<string | null>;

  /** Si `membershipId` puede actuar como este alumno concreto (él mismo, o su tutor). */
  studentAccess(studentId: string, membershipId: string): Promise<StudentAccess>;

  /**
   * Todos los alumnos por los que esta membresía puede navegar en el portal:
   * ella misma si es alumna, o la lista completa de sus tutelados si es
   * tutora (un tutor legal puede serlo de más de un hijo matriculado). Es lo
   * que arma el selector de "cambiar de hijo" — `ownStudentId` solo da el
   * primero, que basta para resolver "mis clases" sin parámetro pero no para
   * ofrecer la lista completa a quien tiene más de uno.
   */
  myStudents(membershipId: string): Promise<PortalStudentOption[]>;

  sessionsForStudent(studentId: string): Promise<PortalSessionEntry[]>;
  attendanceForStudent(studentId: string): Promise<PortalAttendanceEntry[]>;
  invoicesForStudent(studentId: string): Promise<PortalInvoiceEntry[]>;
}

export const PORTAL_READ_MODEL = Symbol("PortalReadModel");
