import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, useLocale, useT } from "./translate.js";
import type { Locale } from "./locale.js";

function wrapper(locale: Locale) {
  return function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return <I18nProvider locale={locale}>{children}</I18nProvider>;
  };
}

describe("useT", () => {
  it("traduce una clave simple en el idioma activo", () => {
    const { result } = renderHook(() => useT(), { wrapper: wrapper("es-ES") });
    expect(result.current("common.retry")).toBe("Reintentar");
  });

  it("cambia de idioma cuando cambia el locale del proveedor", () => {
    // `wrapper` de RTL solo recibe `children` (no las `initialProps` del
    // hook), así que para probar el cambio de idioma se monta un proveedor
    // por locale en vez de reutilizar `rerender` con nuevas props.
    for (const [locale, expected] of [
      ["es-ES", "Reintentar"],
      ["en-GB", "Retry"],
      ["gl-ES", "Tentar de novo"],
    ] as const) {
      const { result } = renderHook(() => useT(), { wrapper: wrapper(locale) });
      expect(result.current("common.retry")).toBe(expected);
    }
  });

  it("interpola parámetros ICU", () => {
    const { result } = renderHook(() => useT(), { wrapper: wrapper("es-ES") });
    expect(result.current("errors.insufficient_role", { required: "owner" })).toBe(
      "Esta acción requiere el rol owner.",
    );
  });

  it("t.has() dice si una clave existe sin lanzar", () => {
    const { result } = renderHook(() => useT(), { wrapper: wrapper("es-ES") });
    expect(result.current.has("errors.missing_tenant")).toBe(true);
    expect(result.current.has("errors.some_future_code")).toBe(false);
  });

  it("una clave que no existe lanza en vez de enseñarla cruda", () => {
    const { result } = renderHook(() => useT(), { wrapper: wrapper("es-ES") });
    expect(() => result.current("errors.some_future_code")).toThrow();
  });

  it("useLocale() expone el locale activo del proveedor", () => {
    const { result } = renderHook(() => useLocale(), { wrapper: wrapper("de-DE") });
    expect(result.current).toBe("de-DE");
  });

  it("sin I18nProvider, useT() usa es-ES por defecto (nunca queda sin idioma)", () => {
    const { result } = renderHook(() => useT());
    expect(result.current("common.retry")).toBe("Reintentar");
  });
});
