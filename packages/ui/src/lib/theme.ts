/**
 * Utilidades de tema para Langopia.
 *
 * Gestiona el modo claro/oscuro, su persistencia en `localStorage` y su
 * aplicación como atributo `data-theme` en el elemento raíz del documento.
 */
export type Theme = "light" | "dark";

const STORAGE_KEY = "langopia:theme" as const;
const THEME_DARK: Theme = "dark";
const THEME_LIGHT: Theme = "light";

function isTheme(value: unknown): value is Theme {
  return value === THEME_LIGHT || value === THEME_DARK;
}

/**
 * Devuelve el tema inicial según el orden de preferencia:
 * 1. Valor persistido en `localStorage["langopia:theme"]`.
 * 2. Preferencia del sistema (`prefers-color-scheme: dark`).
 * 3. "light" como valor por defecto.
 *
 * Es seguro ejecutarla en entornos sin `window` (SSR/test): en ese caso
 * devuelve "light".
 */
export function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return THEME_LIGHT;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isTheme(stored)) {
    return stored;
  }

  const prefersDark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? THEME_DARK : THEME_LIGHT;
}

/**
 * Aplica el tema al documento escribiendo `data-theme` en el `<html>`.
 * En entornos sin `document` no hace nada.
 */
export function applyTheme(theme: Theme): void {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
  }
}

/**
 * Lee el tema actual desde `document.documentElement.dataset.theme`, lo
 * invierte, lo aplica al `<html>` y persiste la preferencia en `localStorage`.
 * Devuelve el nuevo tema.
 *
 * En entornos sin `document` devuelve "light".
 */
export function toggleTheme(): Theme {
  if (typeof document === "undefined") {
    return THEME_LIGHT;
  }

  const current = document.documentElement.dataset.theme;
  const next = current === THEME_DARK ? THEME_LIGHT : THEME_DARK;

  applyTheme(next);

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Algunos navegadores bloquean `localStorage` en modo privado o con
      // cookies deshabilitadas; preferimos mantener el tema cambiado en
      // memoria/DOM a romper la interacción.
    }
  }

  return next;
}
