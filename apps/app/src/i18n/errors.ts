import { useT } from "./translate.js";
import type { Problem } from "../lib/api-client.js";

export type { Problem };

/**
 * La regla de "Quién traduce qué" (`ARCHITECTURE.md`) hecha función: el
 * panel usa su propio catálogo (`errors.*` en los diccionarios de
 * `apps/app/src/i18n/`) cuando conoce el `code` —puede decir más que la
 * API: enlazar a la pantalla que arregla el problema, marcar el campo
 * culpable—; si no lo conoce, cae al `title`, que la API ya manda traducido.
 * El `code` crudo no se enseña en ninguna de las dos ramas.
 */
export function useErrorMessage(): (problem: Problem) => string {
  const t = useT();
  return (problem: Problem): string =>
    t.has(`errors.${problem.code}`)
      ? t(`errors.${problem.code}`, problem.params)
      : problem.title;
}
