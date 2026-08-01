import { describe, expect, it } from "vitest";
import { languageDisplayName, resolveCourseTranslation } from "./format.js";

const TRANSLATIONS = [
  { locale: "es-ES", name: "Español B1 — grupo", description: null },
  { locale: "en-GB", name: "Spanish B1 — group", description: "Intermediate level." },
];

describe("resolveCourseTranslation", () => {
  it("usa el idioma activo del panel cuando el curso lo tiene", () => {
    expect(resolveCourseTranslation(TRANSLATIONS, "en-GB", "es-ES")?.name).toBe("Spanish B1 — group");
  });

  it("cae al idioma por defecto de la escuela cuando el curso no tiene el activo", () => {
    expect(resolveCourseTranslation(TRANSLATIONS, "de-DE", "es-ES")?.name).toBe("Español B1 — grupo");
  });

  it("cae a la primera traducción disponible si ni siquiera está el por defecto", () => {
    expect(resolveCourseTranslation(TRANSLATIONS, "de-DE", "pt-BR")?.name).toBe("Español B1 — grupo");
  });

  it("sin ninguna traducción, devuelve null", () => {
    expect(resolveCourseTranslation([], "es-ES", "es-ES")).toBeNull();
  });
});

describe("languageDisplayName", () => {
  it("traduce el código de idioma de una traducción al idioma activo del panel", () => {
    expect(languageDisplayName("gl-ES", "es-ES")).toBe("gallego");
    expect(languageDisplayName("en-GB", "es-ES")).toBe("inglés");
  });
});
