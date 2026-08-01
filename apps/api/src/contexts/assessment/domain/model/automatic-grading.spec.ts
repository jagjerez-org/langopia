import { describe, expect, it } from "vitest";
import { scoreAutomatically } from "./automatic-grading.js";

describe("scoreAutomatically", () => {
  it("compara un índice único (multiple_choice / listening / reading comprehension)", () => {
    expect(scoreAutomatically({ correct: 1 }, { correct: 1 }, 1).score).toBe(1);
    expect(scoreAutomatically({ correct: 0 }, { correct: 1 }, 1).score).toBe(0);
  });

  it("da crédito parcial por hueco en cloze, comparando contra las respuestas aceptables", () => {
    const solution = { 1: ["desde"], 2: ["tragar", "engullir"] };
    const total = scoreAutomatically({ 1: "desde", 2: "tragar" }, solution, 2);
    expect(total.score).toBe(2);

    const parcial = scoreAutomatically({ 1: "desde", 2: "comer" }, solution, 2);
    expect(parcial.score).toBe(1);
  });

  it("compara una secuencia exacta, posición a posición (ordering / minimal_pairs / dictation)", () => {
    const solution = { order: [2, 0, 1] };
    expect(scoreAutomatically({ order: [2, 0, 1] }, solution, 3).score).toBe(3);
    // Dos de tres posiciones coinciden.
    expect(scoreAutomatically({ order: [2, 1, 1] }, solution, 3).score).toBe(2);
  });

  it("compara pares (matching) por igualdad profunda de cada tupla", () => {
    const solution = {
      pairs: [
        [0, 1],
        [1, 2],
      ],
    };
    expect(
      scoreAutomatically(
        {
          pairs: [
            [0, 1],
            [1, 2],
          ],
        },
        solution,
        2,
      ).score,
    ).toBe(2);
    expect(
      scoreAutomatically(
        {
          pairs: [
            [0, 1],
            [0, 0],
          ],
        },
        solution,
        2,
      ).score,
    ).toBe(1);
  });

  it("una respuesta que no responde a ningún hueco puntúa cero", () => {
    expect(scoreAutomatically({}, { correct: 1 }, 1).score).toBe(0);
  });
});
