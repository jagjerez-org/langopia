import { z } from "zod";
import { DomainError } from "../../../shared/domain/errors/domain-error.js";

/**
 * Tipos de ítem que un examen puede contener (Tarea 15 de la ola 2).
 *
 * Subconjunto deliberado de los once tipos de ejercicio de `learning`, no los
 * once: `assessment` no importa `exercise-schemas.ts` (agregado interno de
 * otro contexto, `ARCHITECTURE.md`), así que esta validación es una copia
 * propia y pequeña, no una réplica de las once — mismo principio que llevó a
 * `WritingCorrectorPort` a duplicar la llamada a Anthropic en vez de
 * reutilizar `ContentGeneratorPort` (Tarea 7).
 *
 * Los cuatro tipos cubren exactamente el reparto por defecto del examen
 * (25 % cada uno, brief verbatim):
 *   - `reading_comprehension` → comprensión lectora
 *   - `spoken_production`     → oral (sin `audioRef`: no hay proveedor de
 *                                audio conectado a esta tarea, igual que
 *                                `generate-unit` rechaza los tipos de audio)
 *   - `written_production`    → expresión escrita
 *   - `cloze` / `multiple_choice` → gramática y léxico (automáticos)
 */
export const ExamItemType = {
  Cloze: "cloze",
  MultipleChoice: "multiple_choice",
  ReadingComprehension: "reading_comprehension",
  WrittenProduction: "written_production",
  SpokenProduction: "spoken_production",
} as const;

export type ExamItemType = (typeof ExamItemType)[keyof typeof ExamItemType];

export const EXAM_ITEM_TYPES = Object.values(ExamItemType) as readonly ExamItemType[];

/** Los dos tipos con rúbrica: sin «correcto» automático, los corrige `WritingCorrectorPort` — la IA propone, el profesor firma. */
export const RUBRIC_EXAM_ITEM_TYPES: ReadonlySet<ExamItemType> = new Set([
  "written_production",
  "spoken_production",
]);

/** Destreza por defecto de cada tipo, para repartir el examen según `skillDistribution`. */
export const DEFAULT_SKILL_BY_EXAM_ITEM_TYPE: Record<ExamItemType, string> = {
  cloze: "grammar",
  multiple_choice: "grammar",
  reading_comprehension: "reading",
  written_production: "writing",
  spoken_production: "speaking",
};

/** Un ítem del examen no valida contra su esquema: no llega nunca al alumno (regla de la ola 2). */
export class InvalidExamItemError extends DomainError {
  readonly code = "invalid_exam_item";
  readonly kind = "invalid_input" as const;

  constructor(type: string, reason: string) {
    super(`El ítem de examen de tipo «${type}» no es válido: ${reason}`, { type, reason });
  }
}

function fail(type: string, reason: string): never {
  throw new InvalidExamItemError(type, reason);
}

function describeZodError(error: z.ZodError, target: "prompt" | "solution"): string {
  const detail = error.issues
    .map((issue) => `${target}${issue.path.length ? `.${issue.path.join(".")}` : ""}: ${issue.message}`)
    .join("; ");
  return detail || `${target} no cumple el esquema esperado.`;
}

/* ─── cloze (subconjunto: siempre cerrado, con opciones) ───────────────── */

const clozePromptSchema = z.object({
  text: z.string().min(1),
  blanks: z.array(z.object({ id: z.number().int() })).min(1),
  options: z.array(z.string().min(1)).min(2),
});

function validateCloze(promptRaw: unknown, solutionRaw: unknown): void {
  const parsedPrompt = clozePromptSchema.safeParse(promptRaw);
  if (!parsedPrompt.success) fail("cloze", describeZodError(parsedPrompt.error, "prompt"));
  const prompt = parsedPrompt.data;

  const blankIds = prompt.blanks.map((b) => b.id);
  for (const id of blankIds) {
    if (!prompt.text.includes(`{{${id}}}`)) {
      fail("cloze", `el texto no marca el hueco {{${id}}} que declara \`blanks\`.`);
    }
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

  const solutionSchema = z.object({ correct: z.number().int() });
  const parsedSolution = solutionSchema.safeParse(solutionRaw);
  if (!parsedSolution.success) fail("multiple_choice", describeZodError(parsedSolution.error, "solution"));

  const { correct } = parsedSolution.data;
  if (correct < 0 || correct >= parsed.data.options.length) {
    fail("multiple_choice", `\`correct\` (${correct}) está fuera de rango de \`options\`.`);
  }
}

/* ─── reading_comprehension ─────────────────────────────────────────── */

const MIN_PASSAGE_LENGTH = 20;

const readingComprehensionPromptSchema = z.object({
  passage: z.string().min(MIN_PASSAGE_LENGTH),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
});

function validateReadingComprehension(promptRaw: unknown, solutionRaw: unknown): void {
  const parsed = readingComprehensionPromptSchema.safeParse(promptRaw);
  if (!parsed.success) fail("reading_comprehension", describeZodError(parsed.error, "prompt"));

  const solutionSchema = z.object({ correct: z.number().int() });
  const parsedSolution = solutionSchema.safeParse(solutionRaw);
  if (!parsedSolution.success)
    fail("reading_comprehension", describeZodError(parsedSolution.error, "solution"));

  const { correct } = parsedSolution.data;
  if (correct < 0 || correct >= parsed.data.options.length) {
    fail("reading_comprehension", `\`correct\` (${correct}) está fuera de rango de \`options\`.`);
  }
}

/* ─── written_production / spoken_production ──────────────────────────
 *
 * Sin «correcto» automático: los corrige una rúbrica y, con ella, un
 * profesor. `solution` no debe traer nada.
 */

const writtenProductionPromptSchema = z.object({
  task: z.string().min(1),
  minWords: z.number().int().positive(),
  maxWords: z.number().int().positive(),
});

function assertNoSolution(type: ExamItemType, solutionRaw: unknown): void {
  if (solutionRaw !== undefined && solutionRaw !== null) {
    fail(type, "este tipo se corrige con rúbrica: no debe traer `solution`.");
  }
}

function validateWrittenProduction(promptRaw: unknown, solutionRaw: unknown): void {
  const parsed = writtenProductionPromptSchema.safeParse(promptRaw);
  if (!parsed.success) fail("written_production", describeZodError(parsed.error, "prompt"));
  if (parsed.data.minWords >= parsed.data.maxWords) {
    fail(
      "written_production",
      `\`minWords\` (${parsed.data.minWords}) debe ser menor que \`maxWords\` (${parsed.data.maxWords}).`,
    );
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

const VALIDATORS: Record<ExamItemType, (prompt: unknown, solution: unknown) => void> = {
  cloze: validateCloze,
  multiple_choice: validateMultipleChoice,
  reading_comprehension: validateReadingComprehension,
  written_production: validateWrittenProduction,
  spoken_production: validateSpokenProduction,
};

/**
 * Valida `prompt`/`solution` de un ítem de examen contra el esquema de su
 * tipo. Un ítem que no valida no llega nunca al alumno: se rechaza entero,
 * nunca a medias.
 */
export function validateExamItem(type: string, prompt: unknown, solution: unknown): void {
  const validator = VALIDATORS[type as ExamItemType];
  if (!validator) {
    fail(type, `«${type}» no es un tipo de ítem de examen conocido.`);
  }
  validator(prompt, solution);
}
