import { z } from "zod";

/**
 * Esquema del SOBRE de salida estructurada de `generateItems`: un array de
 * `{type, skill, prompt, solution?}` sin más forma que esa. La forma PROPIA
 * de cada tipo (los cinco de `exam-item-schemas.ts`) no se repite aquí — la
 * comprueba `validateExamItem`, la única puerta real entre lo que devuelve
 * el modelo y lo que llega al alumno.
 */
export const examGenerationOutputSchema = z.object({
  items: z
    .array(
      z.object({
        type: z.string().min(1),
        skill: z.string().min(1),
        prompt: z.record(z.string(), z.unknown()),
        solution: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .min(1),
});

export type ExamGenerationOutput = z.infer<typeof examGenerationOutputSchema>;

const ITEM_TYPE_SHAPES: Record<string, string> = {
  cloze:
    'cloze: prompt = {"text": string con huecos marcados como "{{n}}", "blanks": [{"id": n}], "options": string[] (mínimo 2)}. ' +
    'solution = {"<id>": string[]}, una entrada por cada hueco de "blanks".',
  multiple_choice:
    'multiple_choice: prompt = {"question": string, "options": string[] (2 a 6 elementos)}. ' +
    'solution = {"correct": índice entero dentro del rango de "options"}.',
  reading_comprehension:
    'reading_comprehension: prompt = {"passage": string (mínimo 20 caracteres), "question": string, "options": string[] (mínimo 2)}. ' +
    'solution = {"correct": índice entero dentro del rango de "options"}.',
  written_production:
    'written_production: prompt = {"task": string, "minWords": entero positivo, "maxWords": entero mayor que "minWords"}. ' +
    'NO incluyas "solution": este tipo se corrige con rúbrica.',
  spoken_production:
    'spoken_production: prompt = {"task": string, "durationSeconds": entero positivo}. ' +
    'NO incluyas "solution": este tipo se corrige con rúbrica.',
};

export function buildExamGenerationPrompt(params: {
  language: string;
  level: string;
  topics: readonly string[];
  items: readonly { skill: string; type: string; count: number }[];
  avoidPrompts: readonly Record<string, unknown>[];
}): { system: string; user: string } {
  const system =
    "Eres un diseñador de exámenes de idiomas. Generas VARIANTES de ejercicios ya practicados: mismo " +
    "tema, misma destreza, mismo nivel MCER, pero un enunciado NUEVO — nunca el mismo texto, las " +
    "mismas opciones ni el mismo hueco que un ejercicio ya visto, porque reutilizarlo mediría memoria, " +
    "no aprendizaje. Cada ítem respeta al milímetro la forma exacta que se te pide para su tipo. " +
    "Respondes siempre con el JSON exacto que se te pide, sin texto antes ni después.";

  const requested = params.items
    .map((i) => `- ${i.count} de tipo «${i.type}» (destreza «${i.skill}»)`)
    .join("\n");

  const typesInvolved = [...new Set(params.items.map((i) => i.type))];
  const shapes = typesInvolved
    .map((type) => `- ${ITEM_TYPE_SHAPES[type] ?? `${type}: tipo no reconocido, no lo generes.`}`)
    .join("\n");

  const avoid =
    params.avoidPrompts.length > 0
      ? `\n\nNO repitas, ni parafrasees casi igual, ninguno de estos enunciados ya usados en práctica:\n` +
        params.avoidPrompts.map((p) => `- ${JSON.stringify(p)}`).join("\n")
      : "";

  const user =
    `Genera los ítems de un examen de «${params.language}», nivel MCER ${params.level}, sobre estos ` +
    `temas: ${params.topics.join(", ")}.\n\n` +
    `Cantidad y tipo exactos:\n${requested}\n\n` +
    `Cada ítem va ENTERAMENTE en «${params.language}» (también las preguntas y las opciones).\n\n` +
    `Devuelve un JSON {"items": [...]} donde cada elemento trae exactamente:\n` +
    `- "type": uno de los tipos pedidos\n` +
    `- "skill": la destreza indicada para ese tipo\n` +
    `- "prompt": el enunciado, con la forma exacta de su tipo\n` +
    `- "solution": la solución, con la forma exacta de su tipo (omite este campo por completo en los ` +
    `tipos que no llevan solución)\n\n` +
    `Formas por tipo:\n${shapes}${avoid}`;

  return { system, user };
}
