/**
 * Rango por defecto para `GET /scheduling/teacher-occupancy` (Tarea 6, Paso 5):
 * el lunes 00:00 (hora local) de esta semana hasta el lunes siguiente.
 *
 * No es un umbral de negocio — eso lo sigue decidiendo la API
 * (`UNDERUSED_BELOW`/`OVERLOADED_ABOVE` en
 * `get-teacher-occupancy.handler.ts`, y la `signal` ya calculada que
 * devuelve—: esto solo elige QUÉ semana mirar por defecto, la misma
 * ventana con la que el seed genera «la ocupación de esta semana»
 * (`mondayOfThisWeek()`/`weekSlot()` en `packages/db/src/seed/helpers.ts`).
 * Con ese mismo rango, `teacherOccupancyBetween` (API) calcula `weeks = 1`
 * exacto, así que `contractedHours` cae en las 24 horas semanales del seed y
 * reproduce los porcentajes del Paso 6 del brief (Carla 92 %, Dan 83 %,
 * Sofia 75 %, Yuki 46 %, Marc 38 %) sin que este fichero calcule nada de
 * eso — solo pide el rango, la API sigue decidiendo el resto.
 *
 * `now` es inyectable para que la prueba sea determinista, igual que
 * `formatRelative` en `apps/app/src/i18n/format.ts`.
 */
export function currentWeekRange(now: Date = new Date()): { from: string; to: string } {
  const monday = new Date(now);
  const isoWeekday = monday.getDay() === 0 ? 7 : monday.getDay();
  monday.setDate(monday.getDate() - (isoWeekday - 1));
  monday.setHours(0, 0, 0, 0);

  const nextMonday = new Date(monday);
  nextMonday.setDate(nextMonday.getDate() + 7);

  return { from: monday.toISOString(), to: nextMonday.toISOString() };
}
