import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES, resolveLocale } from "./locale.resolver.js";
import { translateError } from "./messages.js";

describe("resolveLocale", () => {
  it("prefiere el locale de la persona", () => {
    expect(resolveLocale({ user: "en-GB", school: "es-ES", header: "pt-BR" })).toBe("en-GB");
  });

  it("si la persona no tiene, usa el de la escuela", () => {
    expect(resolveLocale({ user: null, school: "de-DE", header: null })).toBe("de-DE");
  });

  it("si no hay ninguno, negocia con la cabecera del navegador", () => {
    expect(resolveLocale({ user: null, school: null, header: "pt-BR,pt;q=0.9" })).toBe("pt-BR");
  });

  it("cae al español ante un idioma que no soportamos", () => {
    expect(resolveLocale({ user: "sv-SE", school: null, header: null })).toBe("es-ES");
  });

  it("los idiomas soportados incluyen los cuatro del seed", () => {
    expect(SUPPORTED_LOCALES).toEqual(expect.arrayContaining(["es-ES", "en-GB", "de-DE", "pt-BR"]));
  });
});

describe("translateError", () => {
  it("traduce un código conocido", () => {
    const params = { teacherName: "Ana", startsAt: new Date("2026-09-07T10:00:00Z") };
    expect(translateError("teacher_overlap", "en-GB", params)).toMatch(/another class/i);
    expect(translateError("teacher_overlap", "es-ES", params)).toMatch(/otra clase/i);
  });

  // Con los `details` que el error lleva DE VERDAD. Antes esta prueba usaba
  // `teacher_overlap` con `{teacherName, startsAt}`, unos parámetros que
  // `TeacherOverlapError` nunca ha pasado: demostraba que la plantilla
  // interpola, no que el mensaje y su error encajen. Eso lo comprueba ahora
  // `i18n-coverage.spec.ts`, instanciando cada error.
  it("interpola los parámetros del error", () => {
    const message = translateError("concurrency_conflict", "es-ES", {
      resource: "ClassSession",
      id: "abc-123",
    });
    expect(message).toContain("ClassSession");
    expect(message).toContain("abc-123");
    expect(message).not.toContain("{");
  });

  it("resuelve el plural según el idioma", () => {
    expect(translateError("pending_reviews", "es-ES", { count: 1 })).toContain("1 valoración");
    expect(translateError("pending_reviews", "es-ES", { count: 3 })).toContain("3 valoraciones");
  });

  it("ante un código desconocido devuelve null y deja el mensaje original", () => {
    expect(translateError("unknown_code", "es-ES")).toBeNull();
  });
});
