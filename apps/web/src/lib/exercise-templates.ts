import { getDataSource } from "@/lib/database";
import { ExerciseTemplate } from "@/entities";

interface BuiltInTemplate {
  slug: string;
  name: string;
  targetSkill: string;
  promptTemplate: string;
  sortOrder: number;
}

export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  {
    slug: "fill_in_blank",
    name: "Fill in the Blank",
    targetSkill: "vocabulary",
    sortOrder: 0,
    promptTemplate: `Generate {{count}} fill-in-the-blank exercise(s) in {{language}} at CEFR level {{cefrLevel}} about "{{topic}}".

Each exercise should have a sentence with one key word replaced by a blank (___). The blank should test vocabulary or grammar knowledge appropriate for {{cefrLevel}} learners.

{{#sourceContent}}Use this source material as basis:
{{sourceContent}}{{/sourceContent}}

Return JSON: { "exercises": [{ "instruction": "Fill in the blank with the correct word.", "content": "sentence with ___ for the blank", "options": null, "correctAnswer": "the missing word", "explanation": "why this is correct", "cefrLevel": "{{cefrLevel}}", "targetSkill": "vocabulary" }] }`,
  },
  {
    slug: "multiple_choice",
    name: "Multiple Choice",
    targetSkill: "grammar",
    sortOrder: 1,
    promptTemplate: `Generate {{count}} multiple-choice exercise(s) in {{language}} at CEFR level {{cefrLevel}} about "{{topic}}".

Each exercise should have a question or sentence completion with exactly 4 options (one correct, three plausible distractors).

{{#sourceContent}}Use this source material as basis:
{{sourceContent}}{{/sourceContent}}

Return JSON: { "exercises": [{ "instruction": "Choose the correct answer.", "content": "the question or sentence", "options": ["option1", "option2", "option3", "option4"], "correctAnswer": "the correct option text", "explanation": "why this is correct", "cefrLevel": "{{cefrLevel}}", "targetSkill": "grammar" }] }`,
  },
  {
    slug: "sentence_reorder",
    name: "Sentence Reorder",
    targetSkill: "grammar",
    sortOrder: 2,
    promptTemplate: `Generate {{count}} sentence-reorder exercise(s) in {{language}} at CEFR level {{cefrLevel}} about "{{topic}}".

Each exercise provides words/phrases that the student must arrange into the correct sentence order. Provide the words as the "options" array in a shuffled order.

{{#sourceContent}}Use this source material as basis:
{{sourceContent}}{{/sourceContent}}

Return JSON: { "exercises": [{ "instruction": "Arrange the words to form a correct sentence.", "content": "Brief context or hint about the sentence", "options": ["word1", "word2", "word3", "word4"], "correctAnswer": "word2 / word1 / word4 / word3", "explanation": "the grammar rule or structure", "cefrLevel": "{{cefrLevel}}", "targetSkill": "grammar" }] }`,
  },
  {
    slug: "error_correction",
    name: "Error Correction",
    targetSkill: "grammar",
    sortOrder: 3,
    promptTemplate: `Generate {{count}} error-correction exercise(s) in {{language}} at CEFR level {{cefrLevel}} about "{{topic}}".

Each exercise presents a sentence containing one grammatical or vocabulary error. The student must identify and correct it.

{{#sourceContent}}Use this source material as basis:
{{sourceContent}}{{/sourceContent}}

Return JSON: { "exercises": [{ "instruction": "Find and correct the error in this sentence.", "content": "the sentence with an error", "options": null, "correctAnswer": "the corrected sentence", "explanation": "what the error was and the grammar rule", "cefrLevel": "{{cefrLevel}}", "targetSkill": "grammar" }] }`,
  },
  {
    slug: "free_response",
    name: "Free Response",
    targetSkill: "writing",
    sortOrder: 4,
    promptTemplate: `Generate {{count}} free-response writing exercise(s) in {{language}} at CEFR level {{cefrLevel}} about "{{topic}}".

Each exercise gives a writing prompt appropriate for the level. For {{cefrLevel}} learners, adjust complexity accordingly.

{{#sourceContent}}Use this source material as basis:
{{sourceContent}}{{/sourceContent}}

Return JSON: { "exercises": [{ "instruction": "Write your response.", "content": "the writing prompt or question", "options": null, "correctAnswer": "a model answer or key points to include", "explanation": "what makes a good answer", "cefrLevel": "{{cefrLevel}}", "targetSkill": "writing" }] }`,
  },
  {
    slug: "listening",
    name: "Listening",
    targetSkill: "listening",
    sortOrder: 5,
    promptTemplate: `Generate {{count}} listening comprehension exercise(s) in {{language}} at CEFR level {{cefrLevel}} about "{{topic}}".

Each exercise should have a short passage (that will be read aloud via TTS) and a comprehension question with 4 answer options.

{{#sourceContent}}Use this source material as basis:
{{sourceContent}}{{/sourceContent}}

Return JSON: { "exercises": [{ "instruction": "Listen to the passage and answer the question.", "content": "the passage text (will be converted to audio)", "options": ["option1", "option2", "option3", "option4"], "correctAnswer": "the correct option text", "explanation": "why this is correct based on the passage", "cefrLevel": "{{cefrLevel}}", "targetSkill": "listening" }] }`,
  },
];

/**
 * Lazy-seeds built-in templates for an academy on first access.
 * Returns all templates (system + custom) sorted by sortOrder.
 */
export async function ensureBuiltInTemplates(
  academyId: string
): Promise<ExerciseTemplate[]> {
  const ds = await getDataSource();
  const repo = ds.getRepository(ExerciseTemplate);

  // Check existing system templates
  const existing = await repo.find({
    where: { academyId, isSystem: true },
  });

  const existingSlugs = new Set(existing.map((t) => t.slug));

  // Create missing built-in templates
  const toCreate: ExerciseTemplate[] = [];
  for (const bt of BUILT_IN_TEMPLATES) {
    if (!existingSlugs.has(bt.slug)) {
      const t = new ExerciseTemplate();
      t.academyId = academyId;
      t.slug = bt.slug;
      t.name = bt.name;
      t.promptTemplate = bt.promptTemplate;
      t.targetSkill = bt.targetSkill;
      t.isSystem = true;
      t.isActive = true;
      t.sortOrder = bt.sortOrder;
      toCreate.push(t);
    }
  }

  if (toCreate.length > 0) {
    await repo.save(toCreate);
  }

  // Return all templates for this academy
  return repo.find({
    where: { academyId },
    order: { sortOrder: "ASC", createdAt: "ASC" },
  });
}
