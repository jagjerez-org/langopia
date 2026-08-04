import { formatDate } from "../../i18n/format.js";
import type { Locale } from "../../i18n/locale.js";

/**
 * Zona horaria pendiente.
 *
 * `OLA-1-WEB.md` exige mostrar las fechas en la zona horaria DE LA ESCUELA,
 * nunca la del navegador de quien mira la pantalla. Hoy ningún endpoint del
 * panel expone esa zona horaria (comprobado a fondo para esta tarea: ni
 * `GET /students`, ni la sesión, ni el catálogo — ninguna de las tareas 1-6
 * del panel la resolvió tampoco; lo mismo le hace falta al panel de
 * dirección y al calendario, que se están construyendo a la vez). Mientras
 * no exista, se usa "UTC" —la zona en la que la API entrega los ISO
 * 8601— en vez de `Intl.DateTimeFormat().resolvedOptions().timeZone`: sigue
 * sin ser la zona de la escuela, pero nunca es la del navegador, que es la
 * prohibición explícita del brief. Ver el informe de esta tarea.
 */
const PENDING_SCHOOL_TIMEZONE = "UTC";

export function formatStudentDate(
  isoUtc: string,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  return formatDate(isoUtc, PENDING_SCHOOL_TIMEZONE, locale, options);
}
