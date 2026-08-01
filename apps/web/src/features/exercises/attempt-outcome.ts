import type { SubmitAttemptResult } from "./types.js";

/**
 * Qué se le enseña al alumno justo después de enviar (Paso 3 del brief:
 * «corrección inmediata en los tipos automáticos; pendiente de revisión en los
 * de rúbrica»).
 *
 * Lee lo que devuelve la API y nada más. En particular **no deduce del tipo de
 * ejercicio** quién lleva rúbrica: eso llega decidido en
 * `requiresTeacherValidation`, y si un día cambiara qué tipos la exigen, esta
 * pantalla seguiría diciendo la verdad sin tocar una línea.
 *
 * Dos salidas:
 *
 *  · `corrected` — hay nota automática y el ejercicio NO exige firma: el
 *    alumno ve su corrección al momento.
 *  · `pending_review` — o el ejercicio exige rúbrica, o no ha habido
 *    corrección automática que enseñar. En los dos casos falta el profesor.
 *    `aiScore` puede venir igualmente: se enseña como PROPUESTA, porque
 *    mientras el intento no esté `teacher_validated` la nota no cuenta.
 */
export type AttemptOutcome =
  | { kind: "corrected"; score: number; maxScore: number; feedback: string | null }
  | { kind: "pending_review"; proposedScore: number | null; maxScore: number; feedback: string | null };

export function describeAttemptOutcome(result: SubmitAttemptResult): AttemptOutcome {
  if (!result.requiresTeacherValidation && result.aiScore !== null) {
    return {
      kind: "corrected",
      score: result.aiScore,
      maxScore: result.maxScore,
      feedback: result.aiFeedback,
    };
  }
  return {
    kind: "pending_review",
    proposedScore: result.aiScore,
    maxScore: result.maxScore,
    feedback: result.aiFeedback,
  };
}
