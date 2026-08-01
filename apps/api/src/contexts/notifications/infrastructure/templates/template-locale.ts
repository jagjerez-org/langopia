import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
} from "../../../shared/infrastructure/i18n/locale.resolver.js";

/**
 * Los correos usan los MISMOS cinco idiomas que el resto de la API — no una
 * lista propia—: es el andamiaje de `messages.ts`/`i18n-coverage.spec.ts`, ya
 * construido, aplicado aquí donde más se nota (a una persona, no a un
 * mensaje de error).
 *
 * Un idioma que no reconocemos —un dato suelto, nunca debería pasar porque
 * `resolveStudentRecipient` solo devuelve `memberships.locale` o
 * `users.locale`— cae al español antes que fallar el envío entero.
 */
export function templateLocale(raw: string): Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(raw) ? (raw as Locale) : DEFAULT_LOCALE;
}

export function formatDateTime(locale: Locale, iso: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(
    new Date(iso),
  );
}

/** `cents` es el entero congelado por `billing`; formatear para mostrar no es calcular un importe. */
export function formatMoney(locale: Locale, cents: number, currency: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}
