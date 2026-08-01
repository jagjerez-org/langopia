import type { RubricCriterion } from "../model/rubric.vo.js";

/** Coste real de la llamada al modelo. Se devuelve SIEMPRE, valga o no la salida. */
export type CorrectionCost = {
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  model: string;
};

/**
 * Puerto de corrección con IA para los ejercicios sin «correcto» automático
 * (`written_production`, `spoken_production`): los únicos que exigen
 * `rubricId` y `requiresTeacherValidation` (tarea 2, `Exercise.create`).
 *
 * Puerto propio de `assessment` (no el `ContentGeneratorPort` de `learning`,
 * que `assessment` no puede importar — `ARCHITECTURE.md`). El proveedor de
 * IA es un detalle sustituible: el dominio pide una corrección y recibe,
 * junto a ella, lo que costó — igual que `ContentGeneratorPort`, pedirlo
 * aparte abriría la puerta a corregir sin poder cobrarlo.
 *
 * `byCriterion` viene en la escala 0–5 por criterio, no 0–100: es la que usa
 * `Rubric.weightedScore` para llegar a la nota final sobre el `maxScore` del
 * ejercicio.
 */
export interface WritingCorrectorPort {
  correct(params: {
    task: string;
    response: string;
    rubric: { criteria: readonly RubricCriterion[] };
    language: string;
    level: string;
  }): Promise<{ feedback: string; byCriterion: Record<string, number>; cost: CorrectionCost }>;
}

export const WRITING_CORRECTOR_PORT = Symbol("WritingCorrectorPort");
