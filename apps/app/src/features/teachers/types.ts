/**
 * Tipos del cliente para la Tarea 8 (Profesorado), sobre `GET /teachers`
 * (añadido por esta misma tarea, ver el informe) y los comandos de `people`
 * ya construidos (Tareas 2 y 13 del backend).
 */

export type TeacherTier = "community" | "professional" | "specialist";
export type TeacherStatus = "active" | "on_leave" | "left";

export type AvailabilitySlot = { weekday: number; startMinute: number; endMinute: number };

/** Fila de `GET /teachers`. Sin endpoint de detalle propio: la ficha reutiliza esta misma fila. */
export type TeacherListItem = {
  teacherId: string;
  membershipId: string;
  name: string;
  email: string;
  tier: TeacherTier;
  hourlyRateCents: number;
  currency: string;
  contractedHoursWeek: number;
  status: TeacherStatus;
  bio: string | null;
  languages: string[];
  certifications: string[];
  isNativeSpeaker: boolean;
  hiredAt: string;
  leftReason: string | null;
  availability: AvailabilitySlot[];
};

/** Cuerpo de `PUT /teachers/:id/availability`: reemplaza toda la semana. */
export type SetAvailabilityInput = { slots: AvailabilitySlot[] };
export type SetAvailabilityResult = { teacherId: string; slots: number };

/** Cuerpo de `PATCH /teachers/:id`: semántica de parche, campo ausente = no tocar. */
export type UpdateTeacherInput = { tier?: TeacherTier; hourlyRateCents?: number };
export type UpdateTeacherResult = { teacherId: string; tier: TeacherTier; hourlyRateCents: number };

export type ReleaseTeacherResult = { teacherId: string; status: TeacherStatus };

/**
 * Cuerpo de `POST /teachers` (alta de profesor). El endpoint ya existía
 * (Tarea 13 del backend); esta tarea (13 del panel, hallazgo del recorrido de
 * Playwright) es la primera que le da una pantalla — la Tarea 8 del panel
 * decidió a propósito no construirla, ver su informe, «Decisión 3».
 */
export type HireTeacherInput = {
  name: string;
  email: string;
  tier: TeacherTier;
  hourlyRateCents: number;
  contractedHoursPerWeek: number;
  hiredAt: string;
  locale?: string | null;
};
export type HireTeacherResult = { teacherId: string };
