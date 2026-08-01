import { describe, expect, it } from "vitest";
import { InvalidSchoolSlugError, SchoolSlug } from "./school-slug.vo.js";

describe("SchoolSlug", () => {
  it("acepta un identificador válido", () => {
    const slug = SchoolSlug.of("atlantico-idiomas");
    expect(slug.value).toBe("atlantico-idiomas");
  });

  it("rechaza mayúsculas", () => {
    expect(() => SchoolSlug.of("Atlantico")).toThrow(InvalidSchoolSlugError);
  });

  it("rechaza un identificador demasiado corto", () => {
    expect(() => SchoolSlug.of("ab")).toThrow(InvalidSchoolSlugError);
  });

  it("rechaza una palabra reservada", () => {
    expect(() => SchoolSlug.of("api")).toThrow(InvalidSchoolSlugError);
  });

  it("rechaza caracteres que no sean minúsculas, números o guiones", () => {
    expect(() => SchoolSlug.of("atlántico_idiomas!")).toThrow(InvalidSchoolSlugError);
  });
});
