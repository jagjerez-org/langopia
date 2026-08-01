import type { Translate } from "../../i18n/translate.js";

/**
 * Etiqueta traducida de un valor que la API manda como texto libre (el tipo
 * de ejercicio, la destreza, el estado del intento).
 *
 * `t()` lanza si la clave no existe —es un error de programación, no algo que
 * un usuario deba ver—, así que un valor nuevo en la base (un tipo de
 * ejercicio, un estado de intento) tumbaría la pantalla entera del alumno.
 * Con `t.has()` primero, ese caso enseña el valor crudo del servidor: feo,
 * pero la pantalla sigue funcionando y el resto del trabajo se puede hacer.
 */
export function labelFor(t: Translate, key: string, fallback: string): string {
  return t.has(key) ? t(key) : fallback;
}
