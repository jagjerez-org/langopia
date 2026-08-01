import { z } from "zod";

/**
 * Esquema del SOBRE de salida estructurada de `generateExercises`: un array
 * de objetos `{type, prompt, solution?}` sin más forma que esa. La forma
 * PROPIA de cada tipo (los once del brief de la tarea 2) no se repite aquí
 * — sería duplicar la red de seguridad que ya existe—: la comprueba
 * `validateExercise` (`domain/model/exercise-schemas.ts`), la única puerta
 * real entre lo que devuelve el modelo y lo que llega al alumno.
 */
export const exerciseGenerationOutputSchema = z.object({
  exercises: z
    .array(
      z.object({
        type: z.string().min(1),
        prompt: z.record(z.string(), z.unknown()),
        solution: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .min(1),
});

export type ExerciseGenerationOutput = z.infer<typeof exerciseGenerationOutputSchema>;

/**
 * Forma exacta de `prompt`/`solution` por tipo, en el mismo lenguaje que
 * `validateExercise`: describírsela al modelo reduce cuántas veces hace
 * falta el reintento, pero la validación de verdad sigue siendo la del
 * dominio, no esta lista.
 */
const EXERCISE_TYPE_SHAPES: Record<string, string> = {
  cloze:
    'cloze: prompt = {"text": string con huecos marcados como "{{n}}", "blanks": [{"id": n, "hint"?: string}], ' +
    '"openEnded": boolean, "options"?: string[] (solo si openEnded=false, mínimo 2)}. ' +
    'solution = {"<id>": string[]}, una entrada por cada hueco de "blanks", ni una más ni una menos.',
  multiple_choice:
    'multiple_choice: prompt = {"question": string, "options": string[] (2 a 6 elementos)}. ' +
    'solution = {"correct": índice entero dentro del rango de "options"}.',
  matching:
    'matching: prompt = {"left": string[], "right": string[] (el mismo tamaño que "left")}. ' +
    'solution = {"pairs": [[índiceLeft, índiceRight], ...]}, emparejando TODOS los elementos de ' +
    '"left" exactamente una vez, sin índices repetidos.',
  ordering:
    'ordering: prompt = {"tokens": string[] (3 a 12 elementos)}. ' +
    'solution = {"order": number[]}, una permutación EXACTA de los índices de "tokens" (ni uno repetido ni uno ausente).',
  minimal_pairs:
    'minimal_pairs: prompt = {"pairs": [{"a": string, "b": string, "contrast": string}]}. ' +
    'solution = {"sequence": ("a"|"b")[]}, con una respuesta por cada contraste de "pairs".',
  dictation:
    'dictation: prompt = {"audioRef": string, "segments": entero positivo}. ' +
    'solution = {"segments": string[]}, con exactamente ese número de textos.',
  shadowing:
    'shadowing: prompt = {"audioRef": string, "target": string, "maxDelayMs": entero positivo}. ' +
    'NO incluyas "solution": este tipo se autoevalúa por repetición.',
  listening_comprehension:
    'listening_comprehension: prompt = {"audioRef": string, "question": string, "options": string[] (mínimo 2)}. ' +
    'solution = {"correct": índice entero dentro del rango de "options"}.',
  reading_comprehension:
    'reading_comprehension: prompt = {"passage": string (mínimo 20 caracteres), "question": string, "options": string[] (mínimo 2)}. ' +
    'solution = {"correct": índice entero dentro del rango de "options"}.',
  written_production:
    'written_production: prompt = {"task": string, "minWords": entero positivo, "maxWords": entero mayor que "minWords", "register": string}. ' +
    'NO incluyas "solution": este tipo se corrige con rúbrica.',
  spoken_production:
    'spoken_production: prompt = {"task": string, "durationSeconds": entero positivo}. ' +
    'NO incluyas "solution": este tipo se corrige con rúbrica.',
};

export function buildExerciseGenerationPrompt(params: {
  unitBody: string;
  language: string;
  level: string;
  types: string[];
  count: number;
}): { system: string; user: string } {
  const system =
    "Eres un diseñador de ejercicios de idiomas. Cada ejercicio que produces respeta al milímetro " +
    "la forma exacta que se te pide para su tipo: un `prompt`/`solution` con un campo de más o de " +
    "menos, un índice fuera de rango o una permutación incompleta hace que el ejercicio entero se " +
    "rechace antes de llegar al alumnado. Respondes siempre con el JSON exacto que se te pide, sin " +
    "texto antes ni después.";

  const requestedTypes = params.types.length > 0 ? params.types : Object.keys(EXERCISE_TYPE_SHAPES);
  const shapes = requestedTypes
    .map((type) => `- ${EXERCISE_TYPE_SHAPES[type] ?? `${type}: tipo no reconocido, no lo generes.`}`)
    .join("\n");

  const user =
    `A partir del cuerpo de esta unidad de «${params.language}», nivel MCER ${params.level}:\n\n` +
    `"""\n${params.unitBody}\n"""\n\n` +
    `Genera exactamente ${params.count} ejercicios, distribuidos entre estos tipos: ` +
    `${requestedTypes.join(", ")}. Cada ejercicio va ENTERAMENTE en «${params.language}» (también las ` +
    `preguntas y las opciones): este contenido lo practica el alumnado en el idioma que aprende, no ` +
    `en el de la escuela.\n\n` +
    `Devuelve un JSON {"exercises": [...]} donde cada elemento trae exactamente:\n` +
    `- "type": uno de los tipos pedidos\n` +
    `- "prompt": el enunciado, con la forma exacta de su tipo\n` +
    `- "solution": la solución, con la forma exacta de su tipo (omite este campo por completo en los ` +
    `tipos que no llevan solución)\n\n` +
    `Formas por tipo:\n${shapes}`;

  return { system, user };
}
