import { describe, expect, it } from "vitest";
import { hasPlausibleSlugShape } from "./slug.js";

describe("hasPlausibleSlugShape", () => {
  it("acepta minúsculas, números y guiones dentro del rango de longitud", () => {
    expect(hasPlausibleSlugShape("academia-nueva-2")).toBe(true);
  });

  it("rechaza menos de 3 caracteres", () => {
    expect(hasPlausibleSlugShape("ab")).toBe(false);
  });

  it("rechaza más de 40 caracteres", () => {
    expect(hasPlausibleSlugShape("a".repeat(41))).toBe(false);
  });

  it("rechaza mayúsculas y otros caracteres", () => {
    expect(hasPlausibleSlugShape("Academia Nueva")).toBe(false);
    expect(hasPlausibleSlugShape("academia_nueva")).toBe(false);
  });

  it("rechaza la cadena vacía", () => {
    expect(hasPlausibleSlugShape("")).toBe(false);
  });
});
