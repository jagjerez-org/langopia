import { formatDate } from "../../i18n/format.js";
import type { Locale } from "../../i18n/locale.js";

/**
 * `issuedOn` y `dueOn` no son un instante: son una FECHA de calendario
 * (`invoices.issued_on`/`due_on`, columnas `date` de Postgres), que la API
 * entrega a medianoche UTC (`InvoiceMapper.dateOnlyToUtc`) porque un ISO 8601
 * necesita alguna hora.
 *
 * Mostrarlas en la zona horaria de LA ESCUELA —lo que `OLA-1-WEB.md` exige
 * para el resto de fechas— las movería de día para cualquier escuela al oeste
 * de Greenwich: medianoche UTC del 24 de julio son las 21:00 del 23 en São
 * Paulo (UTC−3), así que "emitida el 24" se leería "emitida el 23". Esta
 * función se queda deliberadamente en UTC para estos dos campos —nunca la
 * zona del navegador, tampoco la de la escuela—: es la única forma de que la
 * fecha que se lee sea la misma que decidió quien emitió la factura,
 * independientemente de dónde esté la escuela o quien mira la pantalla.
 *
 * `paidAt` y las fechas de cobros/devoluciones SÍ son un instante real
 * (`timestamptz`) y van con la zona horaria de la escuela de verdad
 * (`GET /scheduling/school-timezone`), no con esta función.
 */
export function formatInvoiceDateOnly(
  isoUtc: string,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  return formatDate(isoUtc, "UTC", locale, options);
}
