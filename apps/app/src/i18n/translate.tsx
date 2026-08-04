import { createContext, useContext, useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import IntlMessageFormat from "intl-messageformat";
import { DICTIONARIES } from "./dictionaries.js";
import { DEFAULT_LOCALE } from "./locale.js";
import type { Locale } from "./locale.js";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/**
 * Fija el idioma para todo lo que haya debajo en el árbol.
 *
 * El valor por defecto del contexto ya es `DEFAULT_LOCALE`: un componente que
 * use `useT()` sin este proveedor por encima no se queda sin idioma, cae en
 * es-ES. Quien monte la aplicación de verdad (la sesión, Tarea 3) envuelve la
 * raíz con el locale de la escuela/usuario activos.
 */
export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}): ReactElement {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/**
 * `t(clave, params?)` traduce e interpola con ICU; `t.has(clave)` dice si
 * existe sin arriesgarse a que `t()` lance. `useErrorMessage()` (`errors.ts`)
 * se apoya en esa distinción: pregunta primero con `has`, solo llama a `t`
 * cuando sabe que la clave existe.
 */
export type Translate = {
  (key: string, params?: Record<string, unknown>): string;
  has(key: string): boolean;
};

function readPath(dict: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => {
    if (node !== null && typeof node === "object" && part in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);
}

export function useT(): Translate {
  const locale = useLocale();
  const dict = DICTIONARIES[locale];

  return useMemo(() => {
    const translate = ((key: string, params?: Record<string, unknown>): string => {
      const pattern = readPath(dict, key);
      if (typeof pattern !== "string") {
        // No hay clave sin traducir en producción: `coverage.spec.ts` (Paso
        // 5b) lo impide para las claves reales. Si esto salta, es un
        // desarrollador pidiendo una clave que no existe — un error de
        // programación, no algo que un usuario deba ver.
        throw new Error(`Falta la clave de traducción «${key}» (${locale}).`);
      }
      return new IntlMessageFormat(pattern, locale).format(params ?? {}) as string;
    }) as Translate;
    translate.has = (key: string): boolean => typeof readPath(dict, key) === "string";
    return translate;
  }, [dict, locale]);
}
