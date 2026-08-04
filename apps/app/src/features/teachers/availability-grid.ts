/**
 * Cuadrícula editable de disponibilidad semanal (Tarea 8 del panel web, Paso
 * 1). `PUT /teachers/:id/availability` (ya construido, Tarea 13 del backend)
 * reemplaza la semana entera con franjas arbitrarias en minutos
 * (`WeeklyAvailability`, dominio de `people`); esta cuadrícula trabaja a hora
 * completa, que es la granularidad de todas las franjas del seed y de lo que
 * de verdad se necesita para marcar disponibilidad —nadie declara "disponible
 * de 9:07 a 9:53"—. `cellsFromSlots`/`slotsFromCells` son la ida y la vuelta:
 * cargar franjas guardadas como celdas activas, y volver a franjas al
 * guardar, fusionando horas contiguas del mismo día en una sola.
 *
 * Sin zona horaria de por medio: `startMinute`/`endMinute` ya son minutos de
 * pared en la zona de la escuela (`teacher_availability`, comentario del
 * esquema), no un instante UTC — no hay nada que convertir aquí.
 */

export type AvailabilitySlot = { weekday: number; startMinute: number; endMinute: number };

/** 1 = lunes … 7 = domingo (ISO-8601), igual que `WeeklyAvailability`. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

const GRID_START_HOUR = 6;
const GRID_END_HOUR = 22;

/** Horas que cubre la cuadrícula, de 06:00 a 22:00, ambas incluidas. */
export function gridHours(): number[] {
  const hours: number[] = [];
  for (let h = GRID_START_HOUR; h <= GRID_END_HOUR; h++) hours.push(h);
  return hours;
}

export function cellKey(weekday: number, hour: number): string {
  return `${weekday}-${hour}`;
}

/** Franjas guardadas → conjunto de celdas activas (una por cada hora que cubren). */
export function cellsFromSlots(slots: AvailabilitySlot[]): Set<string> {
  const cells = new Set<string>();
  for (const slot of slots) {
    const startHour = Math.floor(slot.startMinute / 60);
    const endHour = Math.ceil(slot.endMinute / 60);
    for (let hour = startHour; hour < endHour; hour++) {
      cells.add(cellKey(slot.weekday, hour));
    }
  }
  return cells;
}

/** Celdas activas → franjas, fusionando horas contiguas del mismo día en una sola. */
export function slotsFromCells(cells: Set<string>): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  const hours = gridHours();

  for (const weekday of WEEKDAYS) {
    let runStart: number | null = null;
    let runEnd: number | null = null;

    for (const hour of hours) {
      if (cells.has(cellKey(weekday, hour))) {
        if (runStart === null) runStart = hour;
        runEnd = hour;
        continue;
      }
      if (runStart !== null && runEnd !== null) {
        slots.push({ weekday, startMinute: runStart * 60, endMinute: (runEnd + 1) * 60 });
      }
      runStart = null;
      runEnd = null;
    }

    if (runStart !== null && runEnd !== null) {
      slots.push({ weekday, startMinute: runStart * 60, endMinute: (runEnd + 1) * 60 });
    }
  }

  return slots;
}
