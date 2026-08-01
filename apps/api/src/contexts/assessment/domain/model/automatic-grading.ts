/**
 * Corrección automática determinista para los tipos de ejercicio SIN rúbrica
 * (los otros nueve de los once: `written_production` y `spoken_production`
 * son los únicos con `rubricId`, y se corrigen aparte con
 * `WritingCorrectorPort`).
 *
 * No repite la validación de forma de cada tipo (`validateExercise` en
 * `learning`, tarea 2): eso ya garantizó que `solution` es coherente antes de
 * publicarse. Lo único que hace falta aquí es una comparación genérica,
 * agnóstica del tipo concreto, basada en la FORMA de cada valor de
 * `solution`:
 *
 *   · Si el valor de `solution` es un array y el de `response` TAMBIÉN lo es
 *     (`ordering`, `minimal_pairs`, `dictation`, `matching`): se comparan
 *     posición a posición — es la semántica de «secuencia exacta».
 *   · Si el valor de `solution` es un array pero el de `response` es un
 *     escalar (`cloze`, un valor de `solution` por hueco con las respuestas
 *     aceptables): se comprueba que el valor de `response` esté entre los
 *     aceptables — es la semántica de «una de varias respuestas válidas».
 *   · Si el valor de `solution` es un escalar (`{correct: n}` de
 *     `multiple_choice`, `listening_comprehension`, `reading_comprehension`):
 *     igualdad directa.
 *
 * Cada clave de `solution` puntúa 1 de 1 si acierta, prorrateando el
 * `maxScore` del ejercicio entre todas las claves — así un `cloze` con dos
 * huecos da crédito parcial por acertar uno solo, igual que hace el seed.
 */
export function scoreAutomatically(
  response: Record<string, unknown>,
  solution: Record<string, unknown>,
  maxScore: number,
): { score: number; feedback: string; correctCount: number; totalCount: number } {
  const keys = Object.keys(solution);
  let correctCount = 0;

  for (const key of keys) {
    const expected = solution[key];
    const given = response[key];

    if (Array.isArray(expected)) {
      if (Array.isArray(given)) {
        correctCount += countMatchingPositions(given, expected) / expected.length;
      } else if (expected.some((option) => deepEqual(option, given))) {
        correctCount += 1;
      }
    } else if (deepEqual(given, expected)) {
      correctCount += 1;
    }
  }

  const totalCount = keys.length;
  const score = totalCount === 0 ? 0 : (correctCount / totalCount) * maxScore;

  return {
    score,
    feedback:
      totalCount === 0
        ? "Sin nada que corregir."
        : `${Math.round(correctCount)} de ${totalCount} respuesta(s) correcta(s).`,
    correctCount,
    totalCount,
  };
}

/** Cuántas posiciones de `given` coinciden con `expected`, comparando por índice. */
function countMatchingPositions(given: unknown[], expected: unknown[]): number {
  let matches = 0;
  for (let i = 0; i < expected.length; i++) {
    if (deepEqual(given[i], expected[i])) matches++;
  }
  return matches;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a === "object") return JSON.stringify(a) === JSON.stringify(b);
  return false;
}
