export const AttendanceStatus = {
  Present: "present",
  Late: "late",
  Absent: "absent",
  Excused: "excused",
} as const;

export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

/**
 * De dónde viene una entrada de asistencia.
 *
 * No es un detalle técnico: la analítica necesita distinguir lo detectado por
 * el aula propia (fiable), lo marcado a mano por el profesor (menos fiable) y
 * lo importado del informe de Zoom, Meet o Teams (fiable, pero llega tarde).
 */
export const AttendanceSource = {
  Auto: "auto",
  Manual: "manual",
  Imported: "imported",
} as const;

export type AttendanceSource = (typeof AttendanceSource)[keyof typeof AttendanceSource];
