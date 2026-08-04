import type { CalendarEvent } from "../molecules/Calendar/Calendar.js";

/**
 * Datos ficticios para stories y specs de `Calendar`. Las fechas son relativas
 * a "hoy" para que las historias siempre muestren eventos en las vistas
 * actuales; los specs que necesitan determinismo definen sus propios eventos.
 */

const today = new Date();

/** Día civil de hoy desplazado `offset` días (sin hora). */
function dayAt(offset: number): Date {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
}

/** Eventos, recordatorios y tareas repartidos en varias semanas. */
export const calendarEvents: CalendarEvent[] = [
  { id: "evt-01", date: dayAt(-12), title: "Revisión de matrículas de marzo", kind: "event", time: "10:00" },
  { id: "evt-02", date: dayAt(-12), title: "Enviar informe trimestral", kind: "task" },
  { id: "evt-03", date: dayAt(-8), title: "Clase de conversación B2", kind: "event", time: "17:30" },
  { id: "evt-04", date: dayAt(-5), title: "Renovar suscripción de la plataforma", kind: "reminder" },
  { id: "evt-05", date: dayAt(-2), title: "Tutoría con Ana García", kind: "event", time: "12:00" },
  { id: "evt-06", date: dayAt(-2), title: "Corregir exámenes de listening", kind: "task", time: "09:00" },
  { id: "evt-07", date: dayAt(0), title: "Reunión de equipo docente", kind: "event", time: "11:00" },
  { id: "evt-08", date: dayAt(0), title: "Recordar pago de nóminas", kind: "reminder", time: "08:30" },
  { id: "evt-09", date: dayAt(1), title: "Preparar material para C1", kind: "task" },
  { id: "evt-10", date: dayAt(3), title: "Workshop de pronunciación", kind: "event", time: "18:00" },
  { id: "evt-11", date: dayAt(3), title: "Reservar aula 3", kind: "reminder" },
  { id: "evt-12", date: dayAt(6), title: "Entrevista candidato profesorado", kind: "event", time: "16:00" },
  { id: "evt-13", date: dayAt(9), title: "Publicar notas del trimestre", kind: "task", time: "13:00" },
  { id: "evt-14", date: dayAt(13), title: "Sesión de orientación a familias", kind: "event", time: "19:00" },
];
