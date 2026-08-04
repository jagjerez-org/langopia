import { formatDate } from "../../i18n/format.js";
import type { Locale } from "../../i18n/locale.js";
import type { CourseTranslation } from "./types.js";

/**
 * `starts_on`/`ends_on` son columnas `date` (sin hora ni zona,
 * `packages/db/src/schema/catalog.ts`): se interpretan siempre como
 * medianoche UTC, igual que ya hace `CalendarScreen` con las mismas dos
 * columnas — no hay zona horaria de la escuela que perder porque la fecha no
 * la tiene.
 */
export function formatDateOnly(dateOnly: string, locale: Locale): string {
  return formatDate(`${dateOnly}T00:00:00Z`, "UTC", locale, { dateStyle: "medium" });
}

/**
 * Resuelve qué traducción mostrar: el idioma activo del panel si el curso lo
 * tiene, si no el idioma por defecto de la escuela, y si tampoco existiera
 * (no debería, `Course.create()` lo exige) la primera disponible. Es
 * resolución de idioma para pintar un texto ya traducido por la escuela al
 * darlo de alta —igual que `useT()` cae de un idioma a otro—, no una regla de
 * negocio: la API nunca decide nada distinto según cuál se elija aquí.
 */
export function resolveCourseTranslation(
  translations: CourseTranslation[],
  locale: Locale,
  schoolDefaultLocale: string,
): CourseTranslation | null {
  return (
    translations.find((t) => t.locale === locale) ??
    translations.find((t) => t.locale === schoolDefaultLocale) ??
    translations[0] ??
    null
  );
}

/** Nombre legible de un idioma (p. ej. "es-ES" → "español"), en el idioma activo del panel. */
export function languageDisplayName(localeCode: string, locale: Locale): string {
  const languageTag = localeCode.split("-")[0] ?? localeCode;
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(languageTag) ?? localeCode;
  } catch {
    return localeCode;
  }
}
