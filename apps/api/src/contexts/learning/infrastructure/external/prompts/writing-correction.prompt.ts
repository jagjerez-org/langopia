import { z } from "zod";

/**
 * Esquema del sobre de salida estructurada de `correctWriting`. `byCriterion`
 * se comprueba en el adaptador contra las claves reales de la rúbrica
 * recibida (no aquí: este esquema no conoce la rúbrica de la llamada
 * concreta, solo la forma genérica «cadena → número»).
 */
export const writingCorrectionOutputSchema = z.object({
  score: z.number(),
  feedback: z.string().min(1),
  byCriterion: z.record(z.string(), z.number()),
});

export type WritingCorrectionOutput = z.infer<typeof writingCorrectionOutputSchema>;

/**
 * Prompt de corrección de expresión escrita contra una rúbrica.
 *
 * «La IA propone, el profesor firma» (regla de la ola 2): el prompt lo deja
 * explícito para que la nota que produce el modelo se entienda como una
 * propuesta, nunca como el veredicto final.
 */
export function buildWritingCorrectionPrompt(params: {
  task: string;
  response: string;
  rubric: { criteria: Array<{ key: string; label: string; descriptors: string[] }> };
  language: string;
  level: string;
}): { system: string; user: string } {
  const system =
    "Eres un evaluador experto de expresión escrita en idiomas, nivel MCER. Corriges con la " +
    "rúbrica que se te da, criterio por criterio, sin inventar criterios nuevos ni omitir ninguno " +
    "de los que se te piden. La nota que propones NO es definitiva: un profesor tiene que firmarla " +
    "antes de que cuente para el expediente del alumnado. Respondes siempre con el JSON exacto que " +
    "se te pide, sin texto antes ni después.";

  const criteriaText = params.rubric.criteria
    .map((c) => `- "${c.key}" (${c.label}): ${c.descriptors.join("; ")}`)
    .join("\n");

  const user =
    `Tarea propuesta al alumnado (nivel ${params.level}, idioma «${params.language}»):\n"""\n${params.task}\n"""\n\n` +
    `Respuesta del alumnado:\n"""\n${params.response}\n"""\n\n` +
    `Rúbrica (evalúa cada criterio por separado):\n${criteriaText}\n\n` +
    `Devuelve un JSON con:\n` +
    `- "score": nota global, de 0 a 100\n` +
    `- "feedback": comentario para el alumnado, en «${params.language}»\n` +
    `- "byCriterion": un objeto con EXACTAMENTE una entrada por cada criterio de la rúbrica de ` +
    `arriba (las mismas claves, ni una de más ni de menos), cada una con su nota de 0 a 100`;

  return { system, user };
}
