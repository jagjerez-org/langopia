import type { ExerciseResponse } from "../types.js";

/**
 * Contrato común de los once componentes de ejercicio (Paso 1 del brief).
 *
 * Cada uno recibe el `prompt` tal como llega de la API y devuelve la
 * `response` con la forma que espera `POST /assessments/attempts`; nada más.
 * No piden datos, no envían nada, no saben de qué alumno son ni si la nota
 * cuenta: eso es de la pantalla que los monta.
 */
export interface ExerciseInputProps {
  /** El `prompt` del ejercicio, sin tocar. Su forma la fija `exercise-schemas.ts`. */
  prompt: Record<string, unknown>;
  /** Respuesta en curso, o `undefined` si todavía no se ha contestado nada. */
  value: ExerciseResponse | undefined;
  onChange: (response: ExerciseResponse) => void;
  /**
   * Prefijo único para los `name`/`id` de los controles: en una pantalla con
   * varios ejercicios a la vez, dos grupos de radios con el mismo `name` se
   * comportarían como uno solo.
   */
  fieldPrefix: string;
  /**
   * URL reproducible del audio del ejercicio, si la hubiera. Ver
   * `AudioPlayer`: hoy la API no la manda nunca.
   */
  audioSrc?: string;
}

/* ── Lectores del `prompt` ───────────────────────────────────────────────
 *
 * El `prompt` llega como `Record<string, unknown>` (así lo declara el modelo
 * de lectura). Estos lectores devuelven un valor utilizable o el vacío
 * correspondiente: un `prompt` incompleto pinta un ejercicio pobre, nunca
 * revienta la pantalla entera del alumno.
 */

export function readString(prompt: Record<string, unknown>, key: string): string {
  const value = prompt[key];
  return typeof value === "string" ? value : "";
}

export function readNumber(prompt: Record<string, unknown>, key: string): number | undefined {
  const value = prompt[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function readStringArray(prompt: Record<string, unknown>, key: string): string[] {
  const value = prompt[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function readObjectArray(
  prompt: Record<string, unknown>,
  key: string,
): Record<string, unknown>[] {
  const value = prompt[key];
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
  );
}

/** Cuenta de palabras de un texto libre, para enseñar al alumno cuánto lleva escrito. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/u).length;
}
