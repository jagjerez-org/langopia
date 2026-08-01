import type { Locale } from "../../i18n/locale.js";

/**
 * Formatos propios del panel de dirección (Tarea 6): proporciones (0 a 1) y
 * horas. Los importes ya tienen su formateador compartido
 * (`formatMoney`, `apps/web/src/i18n/format.ts`) — este fichero no lo
 * repite, solo añade lo que a esa función no le hace falta a nadie más
 * todavía.
 */

/**
 * Proporción 0..1 → porcentaje localizado, sin decimales: así el 0,91667 de
 * ocupación de Carla en el seed (22 de 24 horas contratadas) se lee «92 %»,
 * igual que en el documento de diseño (Paso 6 del brief) — con decimales
 * (91,7 %) no calzaría con la cifra redonda que da el diseño.
 */
export function formatPercent(ratio: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(ratio);
}

/** Horas (posiblemente con decimales, ya redondeadas a dos por la API) → cadena localizada, sin ceros de más. */
export function formatHours(hours: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(hours);
}
