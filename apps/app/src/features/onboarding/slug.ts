/**
 * Forma mínima del identificador, EN EL CLIENTE, para no llamar a
 * `GET /schools/slug-availability` por cada tecla obviamente incompleta —
 * igual criterio que `EMAIL_PATTERN` en `LoginScreen`. La autoridad real
 * (longitud, alfabeto, palabra reservada, unicidad global) la tiene siempre
 * el servidor: `SchoolSlug.of()` en el alta, y esta misma comprobación de
 * disponibilidad mientras se escribe.
 */
const SLUG_SHAPE_PATTERN = /^[a-z0-9-]+$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 40;

export function hasPlausibleSlugShape(slug: string): boolean {
  return slug.length >= MIN_LENGTH && slug.length <= MAX_LENGTH && SLUG_SHAPE_PATTERN.test(slug);
}
