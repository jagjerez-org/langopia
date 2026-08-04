import { formatDate } from "../../i18n/format.js";
import type { Locale } from "../../i18n/locale.js";

/**
 * `hired_at` es una columna `date` (sin hora ni zona, `packages/db/src/schema/people.ts`),
 * a diferencia de `joined_at` en alumnado (`timestamp with time zone`, que sí
 * necesitaría la zona horaria de la escuela — pendiente, ver
 * `students/format.ts`). Aquí no hay ninguna zona que perder: se interpreta
 * siempre como medianoche UTC, que es la única forma de que la fecha
 * mostrada coincida con la guardada sin importar dónde esté quien mira la
 * pantalla — igual que ya hace `CalendarScreen` con `starts_on`/`ends_on`.
 */
export function formatDateOnly(dateOnly: string, locale: Locale): string {
  return formatDate(`${dateOnly}T00:00:00Z`, "UTC", locale, { dateStyle: "medium" });
}
