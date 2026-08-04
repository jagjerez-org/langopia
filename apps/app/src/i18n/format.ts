import type { Locale } from "./locale.js";

/**
 * Importe en céntimos → cadena localizada con `Intl.NumberFormat`.
 *
 * Los importes viajan siempre en céntimos (ola 0); dividir a mano en un
 * componente es justo lo que esta función evita. Asume monedas de dos
 * decimales —EUR y BRL, las únicas del seed—: una moneda sin decimales
 * (JPY) necesitaría no dividir entre 100, y eso no lo sabe esta firma sin
 * mirar `Intl.NumberFormat(locale, {style:"currency", currency}).resolvedOptions()`.
 */
export function formatMoney(cents: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

/**
 * Ratio 0–1 → porcentaje localizado, sin decimales (Tarea 16: progreso del
 * alumno). Los ratios del backend viajan como fracción —igual que
 * `assessments.skillBreakdown` u otros datos derivados de notas—, nunca ya
 * multiplicados por 100: mismo motivo que `formatMoney` no divide él mismo
 * entre 100 y aquí sí hace falta `style: "percent"`, que ya multiplica.
 */
export function formatPercent(ratio: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(ratio);
}

/**
 * Fecha ISO 8601 UTC → cadena localizada en la zona horaria de LA ESCUELA
 * (`schools.timezone`), nunca la del navegador de quien mira la pantalla.
 * `timeZone` es obligatorio a propósito: no hay valor por defecto que
 * pudiera colar silenciosamente la zona del sistema.
 */
export function formatDate(
  isoUtc: string,
  timeZone: string,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(new Date(isoUtc));
}

/** De más a menos preciso: el primer umbral que se supera es la unidad que se usa. */
const RELATIVE_UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
  ["second", 1],
];

/**
 * «hace 3 horas» / «dentro de 2 días», en el idioma activo.
 *
 * `now` es inyectable a propósito: sin él, esta función no se puede probar
 * de forma determinista (el resultado cambiaría con el reloj de quien
 * ejecute la prueba). En producción se deja el valor por defecto.
 */
export function formatRelative(isoUtc: string, locale: Locale, now: Date = new Date()): string {
  const diffSeconds = (new Date(isoUtc).getTime() - now.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, secondsInUnit] of RELATIVE_UNITS) {
    if (Math.abs(diffSeconds) >= secondsInUnit || unit === "second") {
      return rtf.format(Math.round(diffSeconds / secondsInUnit), unit);
    }
  }
  // Inalcanzable: "second" (el último umbral, 1) siempre hace de tope.
  return rtf.format(0, "second");
}
