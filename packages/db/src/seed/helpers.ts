/**
 * Utilidades del seed.
 *
 * Determinismo: el relleno usa un PRNG con semilla fija, así que dos
 * ejecuciones producen los mismos datos. Las fechas sí son relativas a
 * `NOW` para que el panel siempre tenga clases «esta semana» —si fueran
 * absolutas, la demo se vería vacía a las dos semanas de escribir el seed.
 */

export const NOW = new Date();

/** Semilla del generador. Cambiarla altera el relleno, nunca los casos borde. */
const SEED = Number(process.env.SEED_RANDOM_SEED ?? 20260725);

/** Mulberry32: pequeño, rápido y reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(SEED);

export function randomInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

export function pick<T>(items: readonly T[]): T {
  const item = items[Math.floor(rand() * items.length)];
  if (item === undefined) throw new Error("pick() sobre una lista vacía");
  return item;
}

/** Elige `n` elementos distintos, de forma determinista. */
export function sample<T>(items: readonly T[], n: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < n && pool.length > 0) {
    const [taken] = pool.splice(Math.floor(rand() * pool.length), 1);
    if (taken !== undefined) out.push(taken);
  }
  return out;
}

export function chance(probability: number): boolean {
  return rand() < probability;
}

/* ─── Fechas ───────────────────────────────────────────────────────────── */

const DAY_MS = 86_400_000;

export function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * DAY_MS);
}

export function daysAgo(days: number): Date {
  return daysFromNow(-days);
}

export function weeksAgo(weeks: number): Date {
  return daysFromNow(-weeks * 7);
}

export function minutesAfter(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** Lunes de la semana actual a las 00:00 locales. Ancla del calendario. */
export function mondayOfThisWeek(): Date {
  const d = new Date(NOW);
  const isoWeekday = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() - (isoWeekday - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Un instante concreto de una semana relativa a la actual.
 * `weekOffset: -1, weekday: 3, hour: 18` → miércoles pasado a las 18:00.
 */
export function weekSlot(weekOffset: number, weekday: number, hour: number, minute = 0): Date {
  const d = mondayOfThisWeek();
  d.setDate(d.getDate() + weekOffset * 7 + (weekday - 1));
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Fecha en formato `YYYY-MM-DD`, que es lo que espera una columna `date`. */
export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Fecha de nacimiento para una edad exacta hoy. Así los menores siguen siéndolo. */
export function birthDateForAge(age: number): string {
  const d = new Date(NOW);
  d.setFullYear(d.getFullYear() - age);
  d.setDate(d.getDate() - 30); // margen para que no cumpla años durante la demo
  return isoDate(d);
}

export function ageFrom(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  let age = NOW.getFullYear() - dob.getFullYear();
  const monthDiff = NOW.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && NOW.getDate() < dob.getDate())) age--;
  return age;
}

export function isMinor(dateOfBirth: string): boolean {
  return ageFrom(dateOfBirth) < 18;
}

/* ─── Dinero ───────────────────────────────────────────────────────────── */

export function euros(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Comisión de plataforma sobre un importe, en céntimos.
 * `bps` en puntos básicos: 250 = 2,50 %. `capCents` la limita por operación.
 */
export function applicationFee(
  amountCents: number,
  bps: number,
  capCents: number | null = null,
): number {
  if (bps <= 0) return 0;
  const fee = Math.round((amountCents * bps) / 10_000);
  return capCents !== null ? Math.min(fee, capCents) : fee;
}

/** IVA español al 21 %, sobre base imponible. */
export function withTax(subtotalCents: number, taxRateBps: number) {
  const taxCents = Math.round((subtotalCents * taxRateBps) / 10_000);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

/* ─── Texto ────────────────────────────────────────────────────────────── */

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Correo determinista a partir del nombre, en el dominio de la escuela. */
export function emailFor(name: string, domain: string): string {
  return `${slugify(name).replace(/-/g, ".")}@${domain}`;
}

/** Numeración de factura por escuela y año: `2026-0042`. */
export function invoiceNumber(year: number, sequence: number): string {
  return `${year}-${String(sequence).padStart(4, "0")}`;
}
