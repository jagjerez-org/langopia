import { describe, expect, it } from "vitest";
import { Rubric } from "./rubric.vo.js";

const CRITERIA = [
  { key: "adecuacion", label: "Adecuación a la tarea", weight: 0.25, descriptors: ["a", "b"] },
  { key: "coherencia", label: "Coherencia y cohesión", weight: 0.25, descriptors: ["a", "b"] },
  { key: "lexico", label: "Riqueza léxica", weight: 0.25, descriptors: ["a", "b"] },
  { key: "correccion", label: "Corrección gramatical", weight: 0.25, descriptors: ["a", "b"] },
];

function rubrica() {
  return Rubric.reconstitute({
    id: "11111111-1111-4111-8111-111111111111",
    code: "mcer-escrita",
    maxScore: 20,
    criteria: CRITERIA,
  });
}

describe("Rubric", () => {
  it("expone sus claves de criterio", () => {
    expect([...rubrica().criterionKeys()].sort()).toEqual([
      "adecuacion",
      "coherencia",
      "correccion",
      "lexico",
    ]);
  });

  it("acepta una corrección con exactamente sus criterios", () => {
    expect(() =>
      rubrica().assertMatchesCriteria({ adecuacion: 5, coherencia: 4, lexico: 4, correccion: 3 }),
    ).not.toThrow();
  });

  it("rechaza una corrección a la que le falta un criterio", () => {
    expect(() => rubrica().assertMatchesCriteria({ adecuacion: 5, coherencia: 4, lexico: 4 })).toThrow(
      /rúbrica/i,
    );
  });

  it("rechaza una corrección con un criterio inventado", () => {
    expect(() =>
      rubrica().assertMatchesCriteria({
        adecuacion: 5,
        coherencia: 4,
        lexico: 4,
        correccion: 3,
        inventado: 1,
      }),
    ).toThrow(/rúbrica/i);
  });

  it("pondera 0-5 por criterio a la escala de maxScore", () => {
    // (5+4+4+3)/4 = 4 sobre 5 → 4/5 * 20 = 16, igual que el ejemplar del seed.
    const score = rubrica().weightedScore({ adecuacion: 5, coherencia: 4, lexico: 4, correccion: 3 });
    expect(score).toBe(16);
  });

  it("pondera con pesos distintos entre criterios", () => {
    const oral = Rubric.reconstitute({
      id: "22222222-2222-4222-8222-222222222222",
      code: "mcer-oral",
      maxScore: 20,
      criteria: [
        { key: "fluidez", label: "Fluidez", weight: 0.3, descriptors: [] },
        { key: "pronunciacion", label: "Pronunciación", weight: 0.25, descriptors: [] },
        { key: "interaccion", label: "Interacción", weight: 0.25, descriptors: [] },
        { key: "rango", label: "Rango", weight: 0.2, descriptors: [] },
      ],
    });
    // 5*0.3 + 5*0.25 + 5*0.25 + 5*0.2 = 5 sobre 5 → 20.
    expect(oral.weightedScore({ fluidez: 5, pronunciacion: 5, interaccion: 5, rango: 5 })).toBe(20);
  });
});
