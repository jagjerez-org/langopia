/**
 * Aritmética pura del progreso del alumno (tarea 16 de la ola 2).
 *
 * Separada a propósito del modelo de lectura (`drizzle-student-progress-
 * read-model.ts`): las consultas SQL no se prueban con dobles en este
 * proyecto (se verifican en vivo contra el seed, como cualquier otro
 * repositorio Drizzle), pero la regla de negocio de esta tarea —«un intento
 * sin firmar no cuenta»— sí es una regla, y aquí vive sola, sin Drizzle ni
 * NestJS, para poder probarla con TDD real.
 */

/** Estado de `attempts.status` que hace que la nota cuente para el expediente. */
const VALIDATED_STATUS = "teacher_validated";

/** Lo mínimo de un intento que hace falta para la media, el desglose y la tendencia. */
export type ValidatableAttempt = {
  status: string;
  /** `null` si la IA todavía no ha corregido, o el profesor no ha firmado. */
  teacherScore: number | null;
  maxScore: number;
  skill: string;
  /** Lunes de la semana de `submittedAt`, `YYYY-MM-DD`. */
  weekStart: string;
};

export type SkillProgress = {
  skill: string;
  averageScore: number;
  attemptCount: number;
};

export type ProgressTrendPoint = {
  weekStart: string;
  /** Media de esa semana en solitario. */
  averageScore: number;
  /** Media móvil de hasta las 4 semanas con datos más recientes, terminando en esta. */
  movingAverage: number;
};

const TREND_WINDOW_WEEKS = 4;
const MAX_TREND_POINTS = 12;

function ratio(attempt: ValidatableAttempt): number {
  return (attempt.teacherScore ?? 0) / attempt.maxScore;
}

/** Solo lo firmado cuenta (regla vinculante de la ola 2, `OLA-2.md`). */
function onlyValidated(attempts: readonly ValidatableAttempt[]): ValidatableAttempt[] {
  return attempts.filter((a) => a.status === VALIDATED_STATUS && a.teacherScore !== null);
}

/**
 * Contenido completado: ejercicios con intento / ejercicios publicados a sus
 * grupos (tabla del brief, fila 1). `null`, no `0`, cuando todavía no hay
 * ningún ejercicio publicado a los grupos del alumno — un 0 % sugeriría que
 * hay contenido y no lo ha tocado, que es una historia distinta.
 */
export function computeCompletionRate(published: number, completed: number): number | null {
  if (published <= 0) return null;
  return completed / published;
}

/** Nota media: media de intentos validados (tabla del brief, fila 2). */
export function computeAverageScore(
  attempts: readonly ValidatableAttempt[],
): { average: number | null; validatedCount: number } {
  const validated = onlyValidated(attempts);
  if (validated.length === 0) return { average: null, validatedCount: 0 };
  const sum = validated.reduce((acc, a) => acc + ratio(a), 0);
  return { average: sum / validated.length, validatedCount: validated.length };
}

/** Desglose por destreza: media por `skill`, solo de lo validado (tabla del brief, fila 3). */
export function computeSkillBreakdown(attempts: readonly ValidatableAttempt[]): SkillProgress[] {
  const validated = onlyValidated(attempts);
  const bySkill = new Map<string, { sum: number; count: number }>();
  for (const a of validated) {
    const bucket = bySkill.get(a.skill) ?? { sum: 0, count: 0 };
    bucket.sum += ratio(a);
    bucket.count += 1;
    bySkill.set(a.skill, bucket);
  }
  return [...bySkill.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([skill, { sum, count }]) => ({ skill, averageScore: sum / count, attemptCount: count }));
}

/**
 * Tendencia: media móvil de 4 semanas (tabla del brief, fila 4).
 *
 * Solo las semanas con al menos un intento validado entran en la serie —no
 * semanas de calendario vacías a 0, que hundirían la media móvil de un
 * alumno que simplemente no tuvo clase esa semana—. La ventana mira hasta las
 * 4 semanas CON DATOS más recientes que terminan en cada punto, no 4 semanas
 * de calendario exactas.
 */
export function computeTrend(attempts: readonly ValidatableAttempt[]): ProgressTrendPoint[] {
  const validated = onlyValidated(attempts);
  const byWeek = new Map<string, { sum: number; count: number }>();
  for (const a of validated) {
    const bucket = byWeek.get(a.weekStart) ?? { sum: 0, count: 0 };
    bucket.sum += ratio(a);
    bucket.count += 1;
    byWeek.set(a.weekStart, bucket);
  }

  const weeks = [...byWeek.keys()].sort();
  const weeklyAverages = weeks.map((week) => {
    const bucket = byWeek.get(week)!;
    return bucket.sum / bucket.count;
  });

  const points = weeks.map((weekStart, i) => {
    const windowStart = Math.max(0, i - (TREND_WINDOW_WEEKS - 1));
    const window = weeklyAverages.slice(windowStart, i + 1);
    const movingAverage = window.reduce((a, b) => a + b, 0) / window.length;
    return { weekStart, averageScore: weeklyAverages[i]!, movingAverage };
  });

  return points.slice(-MAX_TREND_POINTS);
}

function addDaysIso(iso: string, delta: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/**
 * Racha de repaso: días seguidos con tarjetas al día (tabla del brief, fila
 * 5) — el indicador que más correlaciona con no darse de baja.
 *
 * `reviewedDaysIso` es el conjunto de días (zona horaria de la escuela, no
 * del servidor) en los que el alumno repasó al menos una tarjeta
 * (`srs_cards.last_reviewed_at`, ver `drizzle-student-progress-read-model`).
 * Con gracia de un día: si todavía no ha repasado HOY pero sí AYER, la racha
 * sigue contando desde ayer — quien abre el repaso a mediodía no debería ver
 * su racha rota solo porque «hoy» todavía no ha tocado ninguna tarjeta.
 */
export function computeReviewStreak(todayIso: string, reviewedDaysIso: readonly string[]): number {
  if (reviewedDaysIso.length === 0) return 0;
  const days = new Set(reviewedDaysIso);

  let cursor = todayIso;
  if (!days.has(cursor)) {
    cursor = addDaysIso(cursor, -1);
    if (!days.has(cursor)) return 0;
  }

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDaysIso(cursor, -1);
  }
  return streak;
}
