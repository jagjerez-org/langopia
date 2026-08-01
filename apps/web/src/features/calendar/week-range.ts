import { zonedTimeToUtcIso } from "./zoned-time.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Día ISO de la semana (1 = lunes … 7 = domingo) de `instant`, EN `timeZone`. */
function isoWeekday(instant: Date, timeZone: string): number {
  const short = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(instant);
  const byShortName: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return byShortName[short]!;
}

/** "YYYY-MM-DD" de `instant`, EN `timeZone`. `en-CA` da directamente ese orden. */
function localDateString(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/**
 * Suma (o resta, con un valor negativo) días a una fecha "YYYY-MM-DD" pura,
 * sin zona horaria: aritmética de calendario, no de instantes. Se hace en
 * UTC a propósito, para que el resultado no dependa de la zona del navegador.
 */
function addDaysToLocalDate(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export type WeekRange = {
  /** Inicio de la semana (lunes 00:00 local), ISO 8601 UTC. */
  from: string;
  /** Inicio de la semana siguiente — el límite EXCLUSIVO que espera `GET /scheduling/agenda`. */
  to: string;
  /** Las 7 fechas locales "YYYY-MM-DD" de lunes a domingo, para las cabeceras de columna. */
  days: string[];
};

/**
 * Semana de lunes a domingo que contiene `reference`, en la zona horaria de
 * LA ESCUELA — nunca la del navegador. La misma marca UTC puede caer en
 * semanas distintas según la escuela: una clase de las 23:30 UTC ya es lunes
 * en Madrid pero sigue siendo domingo en São Paulo.
 */
export function weekRangeContaining(reference: Date, timeZone: string): WeekRange {
  const weekday = isoWeekday(reference, timeZone);
  // Restar días en milisegundos UTC preserva la hora del día en la zona de la
  // escuela (salvo, como mucho, una hora cerca de un cambio de horario de
  // verano) — suficiente para acertar la FECHA local, que es todo lo que se
  // necesita aquí.
  const monday = localDateString(new Date(reference.getTime() - (weekday - 1) * DAY_MS), timeZone);
  const nextMonday = addDaysToLocalDate(monday, 7);

  return {
    from: zonedTimeToUtcIso(`${monday}T00:00`, timeZone),
    to: zonedTimeToUtcIso(`${nextMonday}T00:00`, timeZone),
    days: Array.from({ length: 7 }, (_, index) => addDaysToLocalDate(monday, index)),
  };
}

/** Adelanta (o retrasa) `reference` un número de semanas completas, sin tocar la hora del día. */
export function addWeeks(reference: Date, weeks: number): Date {
  return new Date(reference.getTime() + weeks * 7 * DAY_MS);
}
