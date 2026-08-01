/**
 * Formas de respuesta del contexto `scheduling`.
 *
 * Una sola definición para los dos lados: la API las importa desde aquí en
 * vez de declararlas de nuevo (`apps/api/.../scheduling-read-model.port.ts` y
 * `.../get-teacher-occupancy.handler.ts`), y el panel hace lo mismo cuando
 * tipa la respuesta de `GET /scheduling/agenda` y
 * `GET /scheduling/teacher-occupancy`. Si alguien cambia un campo en el
 * backend sin tocar este fichero, no compila ninguno de los dos lados — que
 * es justo el punto: hace imposible que la copia del panel se desincronice
 * en silencio.
 *
 * Puros datos, sin comportamiento: nadie los guarda ni decide nada con ellos
 * aquí. Las fechas llegan en ISO 8601 UTC y los importes en céntimos, tal
 * cual los da la API — este paquete no los transforma, solo les da forma.
 */

export type AgendaEntry = {
  sessionId: string;
  groupId: string;
  groupName: string;
  courseCode: string;
  teacherId: string | null;
  teacherName: string | null;
  start: string;
  end: string;
  status: string;
  roomProvider: string;
  roomUrl: string | null;
  topic: string | null;
  enrolledStudents: number;
};

export type TeacherOccupancy = {
  teacherId: string;
  teacherName: string;
  /** Horas realmente programadas o impartidas en el periodo. */
  scheduledHours: number;
  contractedHours: number;
  /** 0 a 1. `contractedHours` a cero da 0, no infinito. */
  occupancyRate: number;
  sessionCount: number;
};

/** Igual que en `get-teacher-occupancy.handler.ts`: el color se decide en el cliente, no aquí. */
export type TeacherOccupancySignal = "overloaded" | "healthy" | "underused";

/** Lo que devuelve de verdad `GET /scheduling/teacher-occupancy`: la ocupación con su señal ya calculada. */
export type TeacherOccupancyView = TeacherOccupancy & {
  signal: TeacherOccupancySignal;
};

/**
 * Lo que devuelve `GET /scheduling/school-timezone` (Tarea 9 del panel).
 *
 * El calendario tiene que mostrar cada clase en la hora de LA ESCUELA, nunca
 * la del navegador (`OLA-1-WEB.md`), y hasta esta tarea ningún endpoint
 * exponía ese dato al panel — cada contexto que lo necesitaba internamente
 * (`SchoolSchedulingPolicyPort.timezone()`) lo mantenía para sí. Este es el
 * primer punto en que se hace visible fuera de la API, mínimo a propósito:
 * un único campo, sin locale ni moneda, que esta pantalla no usa.
 */
export type SchoolTimezone = {
  timezone: string;
};

/** Una fila de `GET /scheduling/groups/:groupId/roster` — el padrón para pasar lista (Tarea 9, Paso 6). */
export type GroupRosterMember = {
  studentId: string;
  name: string;
};

/**
 * Lo que devuelve `GET /scheduling/sessions/:id/cancellation-preview`.
 *
 * El brief de la Tarea 9 exige mostrar si una cancelación generará
 * devolución ANTES de confirmarla, sin que el panel calcule el plazo de
 * aviso. Esta consulta invoca la MISMA `CancellationPolicy` que usaría la
 * cancelación real, en modo lectura: no cancela nada, no persiste nada.
 */
export type CancellationPreview = {
  refundDue: boolean;
  noticeHours: number;
};
