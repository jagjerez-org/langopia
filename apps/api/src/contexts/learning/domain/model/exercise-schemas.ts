import { z } from "zod";
import { DomainError } from "../../../shared/domain/errors/domain-error.js";

/** Espejo de `exercise_type` (`packages/db/src/schema/enums.ts`), comprobado en `enums-match-db.spec.ts`. */
export const ExerciseType = {
  Cloze: "cloze",
  MultipleChoice: "multiple_choice",
  Matching: "matching",
  Ordering: "ordering",
  MinimalPairs: "minimal_pairs",
  Dictation: "dictation",
  Shadowing: "shadowing",
  ListeningComprehension: "listening_comprehension",
  ReadingComprehension: "reading_comprehension",
  WrittenProduction: "written_production",
  SpokenProduction: "spoken_production",
} as const;

export type ExerciseType = (typeof ExerciseType)[keyof typeof ExerciseType];

/** Compatibilidad: Zod y los DTO de entrada validan contra una lista, no un objeto (igual que `ROOM_PROVIDERS`). */
export const EXERCISE_TYPES = Object.values(ExerciseType) as readonly ExerciseType[];

/**
 * Tipos que se corrigen con rúbrica: no hay «correcto» automático que
 * comparar, hace falta que un profesor la lea. `Exercise` (tarea 2) exige
 * `rubricId` y `requiresTeacherValidation: true` para estos dos.
 */
export const RUBRIC_EXERCISE_TYPES: ReadonlySet<ExerciseType> = new Set([
  "written_production",
  "spoken_production",
]);

/**
 * Tipos cuyo `prompt` promete un `audioRef`. `Exercise` (tarea 2) exige que
 * la unidad a la que pertenecen tenga de verdad un recurso de audio: un
 * `audioRef` que apunta a nada no es un ejercicio, es una promesa rota.
 */
export const AUDIO_EXERCISE_TYPES: ReadonlySet<ExerciseType> = new Set([
  "dictation",
  "shadowing",
  "listening_comprehension",
]);

/**
 * Un ejercicio que no valida no llega nunca al alumno (regla de la ola 2).
 * El mensaje se construye con el detalle de qué falta —`reason`— para que el
 * reintento con el error como contexto (tarea 3) tenga algo útil que corregir;
 * la traducción de cara al usuario se queda en un texto genérico por tipo,
 * igual que `invalid_room`: `reason` varía en forma en cada rama y no es
 * interpolable de forma fiable en los cinco idiomas.
 */
export class InvalidExerciseError extends DomainError {
  readonly code = "invalid_exercise";
  readonly kind = "invalid_input" as const;

  constructor(type: string, reason: string) {
    super(`El ejercicio de tipo «${type}» no es válido: ${reason}`, { type, reason });
  }
}

function fail(type: string, reason: string): never {
  throw new InvalidExerciseError(type, reason);
}

/** Convierte los `issues` de Zod en un detalle legible para `InvalidExerciseError`. */
function describeZodError(error: z.ZodError, target: "prompt" | "solution"): string {
  const detail = error.issues
    .map((issue) => `${target}${issue.path.length ? `.${issue.path.join(".")}` : ""}: ${issue.message}`)
    .join("; ");
  return detail || `${target} no cumple el esquema esperado.`;
}

/** Los tipos sin `solution` automática (`written_production`, `spoken_production`, `shadowing`) no admiten nada aquí. */
function assertNoSolution(type: ExerciseType, solutionRaw: unknown): void {
  if (solutionRaw !== undefined && solutionRaw !== null) {
    fail(type, "este tipo se corrige con rúbrica o por repetición: no debe traer `solution`.");
  }
}

/**
 * Comprueba `solution.correct` contra el número de opciones del `prompt`.
 * Comparten esta forma `multiple_choice`, `listening_comprehension` y
 * `reading_comprehension`.
 */
function validateCorrectIndex(type: ExerciseType, solutionRaw: unknown, optionsLength: number): void {
  const solutionSchema = z.object({ correct: z.number().int() });
  const parsed = solutionSchema.safeParse(solutionRaw);
  if (!parsed.success) fail(type, describeZodError(parsed.error, "solution"));

  const { correct } = parsed.data;
  if (correct < 0 || correct >= optionsLength) {
    fail(type, `\`correct\` (${correct}) está fuera de rango: solo hay ${optionsLength} opciones.`);
  }
}

/* ─── cloze ─────────────────────────────────────────────────────────────
 *
 * El hueco abierto (`openEnded: true`) es el que obliga a recuperar la
 * palabra en vez de reconocerla entre opciones: por eso NO admite `options`.
 * Con `openEnded: false` pasa lo contrario, y sin opciones el hueco no se
 * puede resolver de la forma que promete.
 */

const clozePromptSchema = z.object({
  text: z.string().min(1),
  blanks: z
    .array(z.object({ id: z.number().int(), hint: z.string().min(1).optional() }))
    .min(1),
  openEnded: z.boolean(),
  options: z.array(z.string().min(1)).optional(),
});

function validateCloze(promptRaw: unknown, solutionRaw: unknown): void {
  const parsedPrompt = clozePromptSchema.safeParse(promptRaw);
  if (!parsedPrompt.success) fail("cloze", describeZodError(parsedPrompt.error, "prompt"));
  const prompt = parsedPrompt.data;

  const blankIds = prompt.blanks.map((b) => b.id);
  if (new Set(blankIds).size !== blankIds.length) {
    fail("cloze", "hay huecos en `blanks` con el mismo `id` repetido.");
  }
  for (const id of blankIds) {
    if (!prompt.text.includes(`{{${id}}}`)) {
      fail("cloze", `el texto no marca el hueco {{${id}}} que declara \`blanks\`.`);
    }
  }
  const placeholderCount = [...prompt.text.matchAll(/\{\{\d+\}\}/g)].length;
  if (placeholderCount !== blankIds.length) {
    fail("cloze", "el número de marcadores «{{n}}» del texto no coincide con `blanks`.");
  }

  if (prompt.openEnded) {
    if (prompt.options && prompt.options.length > 0) {
      fail(
        "cloze",
        "un hueco abierto (`openEnded: true`) no admite `options`: el hueco abierto obliga a " +
          "recuperar la palabra, no a reconocerla entre alternativas.",
      );
    }
  } else if (!prompt.options || prompt.options.length < 2) {
    fail("cloze", "un hueco cerrado (`openEnded: false`) exige `options` con al menos 2 alternativas.");
  }

  const solutionSchema = z.record(z.string(), z.array(z.string().min(1)).min(1));
  const parsedSolution = solutionSchema.safeParse(solutionRaw);
  if (!parsedSolution.success) fail("cloze", describeZodError(parsedSolution.error, "solution"));

  const solutionKeys = new Set(Object.keys(parsedSolution.data).map(Number));
  const expectedKeys = new Set(blankIds);
  const sameKeys =
    solutionKeys.size === expectedKeys.size && [...expectedKeys].every((id) => solutionKeys.has(id));
  if (!sameKeys) {
    fail("cloze", "`solution` debe traer exactamente una entrada por cada hueco de `blanks`.");
  }
}

/* ─── multiple_choice ───────────────────────────────────────────────── */

const multipleChoicePromptSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(6),
});

function validateMultipleChoice(promptRaw: unknown, solutionRaw: unknown): void {
  const parsed = multipleChoicePromptSchema.safeParse(promptRaw);
  if (!parsed.success) fail("multiple_choice", describeZodError(parsed.error, "prompt"));
  validateCorrectIndex("multiple_choice", solutionRaw, parsed.data.options.length);
}

/* ─── matching ──────────────────────────────────────────────────────── */

const matchingPromptSchema = z.object({
  left: z.array(z.string().min(1)).min(2),
  right: z.array(z.string().min(1)).min(2),
});

const matchingSolutionSchema = z.object({
  pairs: z.array(z.tuple([z.number().int(), z.number().int()])).min(1),
});

function validateMatching(promptRaw: unknown, solutionRaw: unknown): void {
  const parsedPrompt = matchingPromptSchema.safeParse(promptRaw);
  if (!parsedPrompt.success) fail("matching", describeZodError(parsedPrompt.error, "prompt"));
  const { left, right } = parsedPrompt.data;
  if (left.length !== right.length) {
    fail("matching", `\`left\` (${left.length}) y \`right\` (${right.length}) deben tener el mismo tamaño.`);
  }

  const parsedSolution = matchingSolutionSchema.safeParse(solutionRaw);
  if (!parsedSolution.success) fail("matching", describeZodError(parsedSolution.error, "solution"));
  const { pairs } = parsedSolution.data;

  if (pairs.length !== left.length) {
    fail("matching", `\`pairs\` debe emparejar los ${left.length} elementos, y trae ${pairs.length}.`);
  }

  const usedLeft = new Set<number>();
  const usedRight = new Set<number>();
  for (const [l, r] of pairs) {
    if (l < 0 || l >= left.length || r < 0 || r >= right.length) {
      fail("matching", "algún par de `pairs` referencia un índice fuera de rango de `left`/`right`.");
    }
    if (usedLeft.has(l)) fail("matching", `el índice de \`left\` ${l} aparece repetido en \`pairs\`.`);
    if (usedRight.has(r)) fail("matching", `el índice de \`right\` ${r} aparece repetido en \`pairs\`.`);
    usedLeft.add(l);
    usedRight.add(r);
  }
}

/* ─── ordering ──────────────────────────────────────────────────────── */

const orderingPromptSchema = z.object({
  tokens: z.array(z.string().min(1)).min(3).max(12),
});

const orderingSolutionSchema = z.object({
  order: z.array(z.number().int()),
});

function validateOrdering(promptRaw: unknown, solutionRaw: unknown): void {
  const parsedPrompt = orderingPromptSchema.safeParse(promptRaw);
  if (!parsedPrompt.success) fail("ordering", describeZodError(parsedPrompt.error, "prompt"));
  const { tokens } = parsedPrompt.data;

  const parsedSolution = orderingSolutionSchema.safeParse(solutionRaw);
  if (!parsedSolution.success) fail("ordering", describeZodError(parsedSolution.error, "solution"));
  const { order } = parsedSolution.data;

  const expected = new Set(tokens.map((_, i) => i));
  const isPermutation =
    order.length === expected.size &&
    new Set(order).size === order.length &&
    order.every((i) => expected.has(i));
  if (!isPermutation) {
    fail("ordering", `\`order\` debe ser una permutación exacta de los ${tokens.length} índices de \`tokens\`.`);
  }
}

/* ─── minimal_pairs ─────────────────────────────────────────────────── */

const minimalPairsPromptSchema = z.object({
  pairs: z
    .array(z.object({ a: z.string().min(1), b: z.string().min(1), contrast: z.string().min(1) }))
    .min(1),
});

const minimalPairsSolutionSchema = z.object({
  sequence: z.array(z.enum(["a", "b"])).min(1),
});

function validateMinimalPairs(promptRaw: unknown, solutionRaw: unknown): void {
  const parsedPrompt = minimalPairsPromptSchema.safeParse(promptRaw);
  if (!parsedPrompt.success) fail("minimal_pairs", describeZodError(parsedPrompt.error, "prompt"));
  const { pairs } = parsedPrompt.data;

  const parsedSolution = minimalPairsSolutionSchema.safeParse(solutionRaw);
  if (!parsedSolution.success) fail("minimal_pairs", describeZodError(parsedSolution.error, "solution"));
  const { sequence } = parsedSolution.data;

  // Cada contraste de `pairs` se juega una vez: una `sequence` más corta deja
  // contrastes sin preguntar, y una más larga inventa preguntas de la nada.
  if (sequence.length !== pairs.length) {
    fail(
      "minimal_pairs",
      `\`sequence\` debe traer una respuesta por cada contraste de \`pairs\` (${pairs.length}), y trae ${sequence.length}.`,
    );
  }
}

/* ─── dictation ─────────────────────────────────────────────────────── */

const dictationPromptSchema = z.object({
  audioRef: z.string().min(1),
  segments: z.number().int().positive(),
});

const dictationSolutionSchema = z.object({
  segments: z.array(z.string().min(1)),
});

function validateDictation(promptRaw: unknown, solutionRaw: unknown): void {
  const parsedPrompt = dictationPromptSchema.safeParse(promptRaw);
  if (!parsedPrompt.success) fail("dictation", describeZodError(parsedPrompt.error, "prompt"));
  const { segments: segmentCount } = parsedPrompt.data;

  const parsedSolution = dictationSolutionSchema.safeParse(solutionRaw);
  if (!parsedSolution.success) fail("dictation", describeZodError(parsedSolution.error, "solution"));
  const { segments } = parsedSolution.data;

  if (segments.length !== segmentCount) {
    fail(
      "dictation",
      `\`solution.segments\` debe traer ${segmentCount} textos (uno por segmento), y trae ${segments.length}.`,
    );
  }
}

/* ─── shadowing ─────────────────────────────────────────────────────── */

const shadowingPromptSchema = z.object({
  audioRef: z.string().min(1),
  target: z.string().min(1),
  maxDelayMs: z.number().int().positive(),
});

function validateShadowing(promptRaw: unknown, solutionRaw: unknown): void {
  const parsed = shadowingPromptSchema.safeParse(promptRaw);
  if (!parsed.success) fail("shadowing", describeZodError(parsed.error, "prompt"));
  assertNoSolution("shadowing", solutionRaw);
}

/* ─── listening_comprehension ───────────────────────────────────────── */

const listeningComprehensionPromptSchema = z.object({
  audioRef: z.string().min(1),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
});

function validateListeningComprehension(promptRaw: unknown, solutionRaw: unknown): void {
  const parsed = listeningComprehensionPromptSchema.safeParse(promptRaw);
  if (!parsed.success) fail("listening_comprehension", describeZodError(parsed.error, "prompt"));
  validateCorrectIndex("listening_comprehension", solutionRaw, parsed.data.options.length);
}

/* ─── reading_comprehension ─────────────────────────────────────────── */

// 20 caracteres es un umbral bajo a propósito: solo descarta un pasaje vacío
// o una frase suelta, no impone un mínimo pedagógico real (eso lo revisa el
// profesor al validar la unidad).
const MIN_PASSAGE_LENGTH = 20;

const readingComprehensionPromptSchema = z.object({
  passage: z.string().min(MIN_PASSAGE_LENGTH),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
});

function validateReadingComprehension(promptRaw: unknown, solutionRaw: unknown): void {
  const parsed = readingComprehensionPromptSchema.safeParse(promptRaw);
  if (!parsed.success) fail("reading_comprehension", describeZodError(parsed.error, "prompt"));
  validateCorrectIndex("reading_comprehension", solutionRaw, parsed.data.options.length);
}

/* ─── written_production / spoken_production ───────────────────────────
 *
 * Sin `correct` que comparar: los corrige una rúbrica y, con ella, un
 * profesor (`requiresTeacherValidation`, comprobado en `Exercise`, no aquí:
 * ese dato no es parte de `prompt`/`solution`).
 */

const writtenProductionPromptSchema = z.object({
  task: z.string().min(1),
  minWords: z.number().int().positive(),
  maxWords: z.number().int().positive(),
  register: z.string().min(1),
});

function validateWrittenProduction(promptRaw: unknown, solutionRaw: unknown): void {
  const parsed = writtenProductionPromptSchema.safeParse(promptRaw);
  if (!parsed.success) fail("written_production", describeZodError(parsed.error, "prompt"));
  const { minWords, maxWords } = parsed.data;
  if (minWords >= maxWords) {
    fail("written_production", `\`minWords\` (${minWords}) debe ser menor que \`maxWords\` (${maxWords}).`);
  }
  assertNoSolution("written_production", solutionRaw);
}

const spokenProductionPromptSchema = z.object({
  task: z.string().min(1),
  durationSeconds: z.number().int().positive(),
});

function validateSpokenProduction(promptRaw: unknown, solutionRaw: unknown): void {
  const parsed = spokenProductionPromptSchema.safeParse(promptRaw);
  if (!parsed.success) fail("spoken_production", describeZodError(parsed.error, "prompt"));
  assertNoSolution("spoken_production", solutionRaw);
}

/* ─── despacho ──────────────────────────────────────────────────────── */

const VALIDATORS: Record<ExerciseType, (prompt: unknown, solution: unknown) => void> = {
  cloze: validateCloze,
  multiple_choice: validateMultipleChoice,
  matching: validateMatching,
  ordering: validateOrdering,
  minimal_pairs: validateMinimalPairs,
  dictation: validateDictation,
  shadowing: validateShadowing,
  listening_comprehension: validateListeningComprehension,
  reading_comprehension: validateReadingComprehension,
  written_production: validateWrittenProduction,
  spoken_production: validateSpokenProduction,
};

/**
 * Valida `prompt` y `solution` contra el esquema de `type`.
 *
 * Es la frontera entre lo que devuelve el modelo y lo que llega al alumno:
 * lanza `InvalidExerciseError` con el detalle de qué falta, y no vuelve nada
 * — un ejercicio que no valida no se corrige a medias, se rechaza entero.
 * No comprueba `rubricId` ni el audio real de la unidad: esas dos reglas
 * necesitan datos que no son ni `prompt` ni `solution` (viven en `Exercise`).
 */
export function validateExercise(type: ExerciseType, prompt: unknown, solution: unknown): void {
  const validator = VALIDATORS[type];
  if (!validator) {
    fail(String(type), `«${type}» no es un tipo de ejercicio conocido.`);
  }
  validator(prompt, solution);
}
