/**
 * Los cinco idiomas del panel, en paralelo a `SUPPORTED_LOCALES` de la API
 * (`apps/api/src/contexts/shared/infrastructure/i18n/locale.resolver.ts`).
 *
 * Es una lista duplicada a propósito por ahora: la API compila a CommonJS con
 * resolución `NodeNext`, el panel es ESM con resolución `bundler`, y no existe
 * todavía un paquete compartido entre los dos (`packages/contracts` es de la
 * Tarea 2, en marcha a la vez que esta). Cuando exista, esta constante es
 * buena candidata a moverse ahí; hasta entonces, `coverage.spec.ts` (Paso 4c)
 * es la prueba que impide que las dos listas diverjan en la práctica: no en
 * los idiomas soportados en sí (ambas listas están escritas a mano y deben
 * coincidir por inspección), sino en los `code` de error que cada lado dice
 * conocer.
 */
export const SUPPORTED_LOCALES = ["es-ES", "en-GB", "de-DE", "pt-BR", "gl-ES"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "es-ES";

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
