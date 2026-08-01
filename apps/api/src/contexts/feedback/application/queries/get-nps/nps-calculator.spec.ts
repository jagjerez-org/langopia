import { describe, expect, it } from "vitest";
import { calculateNps } from "./nps-calculator.js";

describe("calculateNps", () => {
  it("devuelve 100 si todas las respuestas son promotoras", () => {
    expect(calculateNps([9, 10, 9])).toEqual({
      score: 100,
      respondents: 3,
      promoters: 3,
      passives: 0,
      detractors: 0,
    });
  });

  it("devuelve 0 con mitad promotores y mitad detractores", () => {
    expect(calculateNps([10, 9, 6, 0]).score).toBe(0);
  });

  it("excluye pasivos del numerador pero no del denominador", () => {
    expect(calculateNps([10, 8, 7, 6])).toEqual({
      score: 0,
      respondents: 4,
      promoters: 1,
      passives: 2,
      detractors: 1,
    });
  });

  it("maneja explícitamente cero respuestas", () => {
    expect(calculateNps([])).toEqual({
      score: null,
      respondents: 0,
      promoters: 0,
      passives: 0,
      detractors: 0,
    });
  });
});
