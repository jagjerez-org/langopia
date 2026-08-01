import { createElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useErrorMessage, type Problem } from "./errors.js";
import { I18nProvider } from "./translate.js";
import type { Locale } from "./locale.js";

// Fichero `.spec.ts` (no `.tsx`), tal como pide el brief de la Tarea 5:
// `createElement` en vez de sintaxis JSX para el envoltorio de prueba.
function wrapper(locale: Locale) {
  return function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return createElement(I18nProvider, { locale, children });
  };
}

function errorMessageTranslatorFor(locale: Locale) {
  return renderHook(() => useErrorMessage(), { wrapper: wrapper(locale) }).result.current;
}

describe("useErrorMessage", () => {
  it("un code que el panel conoce usa SU catálogo, no el title de la API", () => {
    const errorMessage = errorMessageTranslatorFor("es-ES");
    const problem: Problem = {
      code: "missing_tenant",
      title: "algo distinto que mandó la API",
      status: 403,
    };
    expect(errorMessage(problem)).toBe("Necesitas iniciar sesión y elegir una escuela.");
  });

  it("interpola los params del problem con el patrón ICU del panel", () => {
    const errorMessage = errorMessageTranslatorFor("es-ES");
    const problem: Problem = {
      code: "insufficient_role",
      title: "Esta acción requiere el rol owner.",
      status: 403,
      params: { required: "owner" },
    };
    expect(errorMessage(problem)).toBe("Esta acción requiere el rol owner.");
  });

  it("un code que el panel NO conoce cae al title, ya traducido por la API", () => {
    const errorMessage = errorMessageTranslatorFor("es-ES");
    const problem: Problem = {
      code: "algun_code_futuro_que_el_panel_no_conoce_todavia",
      title: "Mensaje ya traducido por la API para este code futuro.",
      status: 422,
    };
    expect(errorMessage(problem)).toBe("Mensaje ya traducido por la API para este code futuro.");
  });

  it("en ningún caso se enseña el code crudo", () => {
    const errorMessage = errorMessageTranslatorFor("es-ES");
    const conocido = errorMessage({ code: "not_found", title: "titulo api", status: 404 });
    const desconocido = errorMessage({ code: "codigo_rarisimo_xyz", title: "titulo api 2", status: 500 });
    expect(conocido).not.toContain("not_found");
    expect(desconocido).not.toContain("codigo_rarisimo_xyz");
  });

  it("respeta el idioma activo también para los errores", () => {
    const errorMessage = errorMessageTranslatorFor("pt-BR");
    const problem: Problem = { code: "missing_tenant", title: "título en inglés o lo que sea", status: 403 };
    expect(errorMessage(problem)).toBe("Você precisa entrar e escolher uma escola.");
  });
});
