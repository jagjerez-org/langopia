/**
 * Conversión entre la hora de pared de una zona horaria arbitraria (la de la
 * escuela) y el instante UTC que envía y recibe la API.
 *
 * Las fechas llegan de la API en ISO 8601 UTC y se muestran en la zona
 * horaria de LA ESCUELA (`OLA-1-WEB.md`); `formatDate` (`i18n/format.ts`) ya
 * resuelve la mitad de LECTURA de ese problema con `Intl.DateTimeFormat`. Lo
 * que falta aquí es la mitad de ESCRITURA: cuando alguien escribe una hora en
 * un `<input type="datetime-local">` para programar o replanificar una
 * clase, ese valor es una hora de pared SIN zona — el navegador no sabe que
 * significa "las 16:00 en Madrid" y no "las 16:00 donde esté el navegador".
 * Interpretarlo con `new Date(valor)` a secas usaría la zona del sistema, que
 * es exactamente el fallo que esta pantalla existe para evitar.
 *
 * No hay ninguna librería de zonas horarias en el monorepo (`date-fns-tz`,
 * `luxon`...). Estas dos funciones usan solo `Intl.DateTimeFormat`, ya
 * disponible en cualquier navegador moderno, con la misma técnica de
 * "instante de prueba, medir el desfase, corregir" que esas librerías usan
 * por dentro.
 */

/** Desfase (en milisegundos) de `timeZone` respecto a UTC, en el instante `instant`. */
function offsetMillis(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  const wallClockAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return wallClockAsUtc - instant.getTime();
}

/**
 * `"YYYY-MM-DDTHH:mm"` (el valor de un `<input type="datetime-local">`),
 * interpretado como hora de pared EN `timeZone`, a ISO 8601 UTC.
 */
export function zonedTimeToUtcIso(localValue: string, timeZone: string): string {
  const naiveUtc = new Date(`${localValue}:00.000Z`);
  const offset = offsetMillis(naiveUtc, timeZone);
  let instant = new Date(naiveUtc.getTime() - offset);
  // Segunda pasada: si el desfase medido en el instante corregido difiere
  // del primero (posible cerca de un cambio de horario de verano), se
  // recalcula una vez más — converge en el caso general.
  const offset2 = offsetMillis(instant, timeZone);
  if (offset2 !== offset) instant = new Date(naiveUtc.getTime() - offset2);
  return instant.toISOString();
}

/**
 * ISO 8601 UTC a `"YYYY-MM-DDTHH:mm"` en `timeZone` — el valor que espera un
 * `<input type="datetime-local">`. Inversa de `zonedTimeToUtcIso`.
 */
export function utcIsoToZonedInputValue(isoUtc: string, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(isoUtc)).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Fecha local ("YYYY-MM-DD") y minutos desde la medianoche local, EN `timeZone`, de un instante UTC. */
export function zonedDateAndMinutes(
  isoUtc: string,
  timeZone: string,
): { date: string; minutes: number } {
  const value = utcIsoToZonedInputValue(isoUtc, timeZone);
  const [date, time] = value.split("T") as [string, string];
  const [hour, minute] = time.split(":").map(Number) as [number, number];
  return { date, minutes: hour * 60 + minute };
}
