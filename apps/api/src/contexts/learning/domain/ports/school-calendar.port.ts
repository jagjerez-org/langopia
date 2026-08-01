/**
 * La fecha de «hoy» en la zona horaria de la escuela activa.
 *
 * Un repaso que vence «mañana» depende de dónde está la escuela, no de dónde
 * corre el proceso (el servidor) ni de la zona horaria de quien mira el
 * navegador. `today()` recibe el instante (`Clock.now()`, para que las
 * pruebas lo controlen sin esperar de verdad) y devuelve la fecha de
 * calendario ya resuelta (`YYYY-MM-DD`) en la zona horaria de la escuela —
 * exactamente lo que esperan `SrsCard.review()` y la columna `due_on`.
 *
 * Mismo problema, mismo remedio de `scheduling`
 * (`SchoolSchedulingPolicyPort.timezone()`): un contexto no importa el puerto
 * de otro (`ARCHITECTURE.md`), así que `learning` declara el suyo propio, en
 * su propio lenguaje.
 */
export interface SchoolCalendarPort {
  today(now: Date): Promise<string>;
}

export const SCHOOL_CALENDAR_PORT = Symbol("SchoolCalendarPort");
