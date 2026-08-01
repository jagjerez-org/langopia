import { describe, expect, it } from "vitest";
import { DateOfBirth } from "./date-of-birth.vo.js";

const HOY = new Date("2026-07-25T12:00:00Z");

describe("DateOfBirth", () => {
  it("calcula la edad", () => {
    expect(DateOfBirth.of("2000-01-15").ageAt(HOY)).toBe(26);
  });

  it("no suma el año si aún no ha cumplido", () => {
    expect(DateOfBirth.of("2000-12-15").ageAt(HOY)).toBe(25);
  });

  it("considera menor a quien tiene 17", () => {
    expect(DateOfBirth.of("2009-01-01").isMinorAt(HOY)).toBe(true);
  });

  it("considera adulto a quien cumple 18 hoy", () => {
    expect(DateOfBirth.of("2008-07-25").isMinorAt(HOY)).toBe(false);
  });

  it("rechaza una fecha futura", () => {
    expect(() => DateOfBirth.of("2030-01-01").ageAt(HOY)).toThrow(/futuro/);
  });

  it("rechaza una edad imposible", () => {
    expect(() => DateOfBirth.of("1850-01-01").ageAt(HOY)).toThrow(/no es plausible/);
  });
});
