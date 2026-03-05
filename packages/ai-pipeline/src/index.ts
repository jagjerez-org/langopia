import OpenAI from "openai";

export interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
  language: string;
}

export interface TranscriptionSegment {
  speaker: "teacher" | "student";
  text: string;
  start: number;
  end: number;
  words: WordTimestamp[];
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface AnalysisResult {
  summary: string;
  vocabulary: VocabularyItem[];
  grammarErrors: GrammarError[];
  speakingMetrics: SpeakingMetrics;
  suggestions: string[];
}

export interface VocabularyItem {
  word: string;
  cefrLevel: string;
  context: string;
  isNew: boolean;
}

export interface GrammarError {
  text: string;
  correction: string;
  rule: string;
  explanation: string;
  offset: number;
}

export interface SpeakingMetrics {
  studentSpeakingTime: number;
  teacherSpeakingTime: number;
  totalDuration: number;
  speakingRatio: number;
  fillerWordCount: number;
  averagePauseLength: number;
}

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export async function transcribeAudio(
  audioUrl: string
): Promise<TranscriptionResult> {
  // Download the audio file from S3/MinIO
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const file = new File([new Uint8Array(arrayBuffer)], "recording.mp4", {
    type: "video/mp4",
  });

  // Call Whisper API with verbose_json for word-level timestamps
  const transcription = await getOpenAI().audio.transcriptions.create({
    model: "whisper-1",
    file,
    response_format: "verbose_json",
    timestamp_granularities: ["word", "segment"],
  });

  const language = transcription.language ?? "en";

  // Map Whisper segments to our format
  // Note: Whisper doesn't distinguish speakers. We label all as "teacher" by default;
  // speaker diarization would require a separate pipeline.
  const segments: TranscriptionSegment[] = (
    transcription.segments ?? []
  ).map((seg) => {
    const segWords: WordTimestamp[] = (transcription.words ?? [])
      .filter((w) => w.start >= seg.start && w.end <= seg.end)
      .map((w) => ({
        word: w.word,
        start: w.start,
        end: w.end,
        confidence: 1.0,
      }));

    return {
      speaker: "teacher" as const,
      text: seg.text.trim(),
      start: seg.start,
      end: seg.end,
      words: segWords,
    };
  });

  return {
    text: transcription.text,
    segments,
    language,
  };
}

// ─── Speaker Diarization (Phase 6) ────────────────────────

export async function diarizeSpeakers(
  segments: TranscriptionSegment[],
  context: { teacherName: string; studentNames: string[] }
): Promise<TranscriptionSegment[]> {
  if (segments.length === 0) return segments;

  const transcript = segments
    .map((s, i) => `[${i}] ${s.text}`)
    .join("\n");

  const prompt = `You are analyzing a language class transcription to identify who is speaking in each segment.

Context:
- Teacher: ${context.teacherName}
- Students: ${context.studentNames.join(", ") || "Unknown"}

For each segment, determine if the speaker is the "teacher" or "student" based on:
- Teachers typically: give instructions, explain grammar, ask questions to test knowledge, correct errors, provide feedback
- Students typically: answer questions, attempt exercises, make errors, ask for clarification, practice vocabulary

Return a JSON object:
{
  "speakers": ["teacher" | "student", ...]
}

The array must have exactly ${segments.length} elements, one per segment.

Transcript:
${transcript}

Return ONLY valid JSON.`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    const speakers: string[] = parsed.speakers ?? [];

    return segments.map((seg, i) => ({
      ...seg,
      speaker: (speakers[i] === "student" ? "student" : "teacher") as "teacher" | "student",
    }));
  } catch {
    // Fallback: return segments unchanged
    return segments;
  }
}

// ─── Live Transcription (Phase 6) ─────────────────────────

export async function transcribeChunk(
  audioBlob: File
): Promise<string> {
  const transcription = await getOpenAI().audio.transcriptions.create({
    model: "whisper-1",
    file: audioBlob,
    response_format: "text",
  });
  return typeof transcription === "string" ? transcription : "";
}

// ─── Session Analysis (Phase 4) ──────────────────────────

function computeSpeakingMetrics(
  transcription: TranscriptionResult
): SpeakingMetrics {
  let teacherTime = 0;
  let studentTime = 0;
  let fillerWordCount = 0;
  const fillerWords = new Set([
    "um", "uh", "er", "ah", "like", "you know", "so", "well", "hmm",
  ]);

  for (const seg of transcription.segments) {
    const duration = seg.end - seg.start;
    if (seg.speaker === "teacher") {
      teacherTime += duration;
    } else {
      studentTime += duration;
    }
    for (const w of seg.words) {
      if (fillerWords.has(w.word.toLowerCase().trim())) {
        fillerWordCount++;
      }
    }
  }

  const totalDuration =
    transcription.segments.length > 0
      ? transcription.segments[transcription.segments.length - 1].end -
        transcription.segments[0].start
      : 0;

  // Calculate average pause between segments
  let totalPause = 0;
  let pauseCount = 0;
  for (let i = 1; i < transcription.segments.length; i++) {
    const gap =
      transcription.segments[i].start - transcription.segments[i - 1].end;
    if (gap > 0.3) {
      totalPause += gap;
      pauseCount++;
    }
  }

  return {
    studentSpeakingTime: Math.round(studentTime * 100) / 100,
    teacherSpeakingTime: Math.round(teacherTime * 100) / 100,
    totalDuration: Math.round(totalDuration * 100) / 100,
    speakingRatio:
      studentTime + teacherTime > 0
        ? Math.round((studentTime / (studentTime + teacherTime)) * 100) / 100
        : 0,
    fillerWordCount,
    averagePauseLength:
      pauseCount > 0 ? Math.round((totalPause / pauseCount) * 100) / 100 : 0,
  };
}

export async function analyzeSession(
  transcription: TranscriptionResult
): Promise<AnalysisResult> {
  const speakingMetrics = computeSpeakingMetrics(transcription);

  const prompt = `You are a language learning analyst. Analyze this class transcription and return a JSON object with exactly this structure:

{
  "summary": "A 3-5 sentence summary of the class session, covering what was taught and key interactions.",
  "vocabulary": [
    {
      "word": "the word or phrase",
      "cefrLevel": "A1|A2|B1|B2|C1|C2",
      "context": "the sentence where it appeared",
      "isNew": true
    }
  ],
  "grammarErrors": [
    {
      "text": "the incorrect text from the student",
      "correction": "the corrected version",
      "rule": "brief grammar rule name",
      "explanation": "clear explanation of the error",
      "offset": 0
    }
  ],
  "suggestions": ["actionable improvement suggestion 1", "suggestion 2", "suggestion 3"]
}

Rules:
- Extract 5-15 notable vocabulary items, focusing on words B1 level and above
- Identify grammar errors from student speech only
- Provide 3-5 concrete, actionable suggestions for the student
- The language detected is: ${transcription.language}
- Return ONLY valid JSON, no markdown fences or extra text

Transcription:
${transcription.segments.map((s) => `[${s.speaker}] ${s.text}`).join("\n")}`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);

  return {
    summary: parsed.summary ?? "",
    vocabulary: (parsed.vocabulary ?? []).map((v: Record<string, unknown>) => ({
      word: String(v.word ?? ""),
      cefrLevel: String(v.cefrLevel ?? "B1"),
      context: String(v.context ?? ""),
      isNew: Boolean(v.isNew ?? true),
    })),
    grammarErrors: (parsed.grammarErrors ?? []).map(
      (g: Record<string, unknown>) => ({
        text: String(g.text ?? ""),
        correction: String(g.correction ?? ""),
        rule: String(g.rule ?? ""),
        explanation: String(g.explanation ?? ""),
        offset: Number(g.offset ?? 0),
      })
    ),
    speakingMetrics,
    suggestions: (parsed.suggestions ?? []).map(String),
  };
}

// ─── Progress Report Generation (Phase 4) ────────────────

export interface ProgressReportInput {
  studentName: string;
  classroomName: string;
  language: string;
  periodStart: Date;
  periodEnd: Date;
  classReports: {
    date: string;
    summary: string;
    vocabulary: VocabularyItem[];
    grammarErrors: GrammarError[];
    speakingMetrics: SpeakingMetrics;
  }[];
  currentCefrEstimate: string | null;
}

// ─── Exercise Generation (Type-based) ────────────────────

export interface GeneratedExercise {
  type: string;
  title?: string;
  instruction: string;
  content: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  cefrLevel: string;
  targetSkill: string;
  needsAudio?: boolean;
}

export interface TypeExerciseRequest {
  type: string;
  count: number;
}

export interface TypeGenerationInput {
  requests: TypeExerciseRequest[];
  language: string;
  cefrLevel: string;
  topic: string;
  sourceContent?: string;
  customPrompt?: string;
  existingSummaries?: string[];
  searchCallback?: (query: string) => Promise<{ results: string; tokensUsed: number }>;
}

export interface TypeGenerationResult {
  exercises: GeneratedExercise[];
  tokensUsed: number;
}

/**
 * Replaces {{key}} placeholders and handles {{#key}}...{{/key}} conditional blocks.
 */
export function interpolateTemplate(
  template: string,
  vars: Record<string, string | undefined>
): string {
  let result = template;

  // Handle conditional blocks: {{#key}}...{{/key}}
  result = result.replace(
    /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (_, key, content) => {
      return vars[key]?.trim() ? content.replace(/\{\{(\w+)\}\}/g, (_m: string, k: string) => vars[k] ?? "") : "";
    }
  );

  // Replace simple placeholders
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");

  return result;
}

// ─── Hardcoded Exercise Prompts (one per type) ───────────

const EXERCISE_PROMPTS: Record<string, string> = {
  warm_up: `Generate {{count}} "Warm Up" exercise(s) in {{language}} at CEFR {{cefrLevel}} about "{{topic}}".

A warm-up exercise presents a text passage (or scenario) and asks the student for a free-text response — reflection, opinion, short answer, etc.

{{#sourceContent}}Source material:
{{sourceContent}}{{/sourceContent}}

{{#existingExercises}}EXISTING EXERCISES (pre-fetched via RAG):
Similarity levels: VERY_HIGH = near-duplicate, HIGH = very similar, MEDIUM = same topic area.
You MUST NOT duplicate VERY_HIGH or HIGH exercises. For MEDIUM, vary the specific content significantly.
If unsure whether your exercise duplicates an existing one, use the search_exercises tool to check.
---
{{existingExercises}}
---{{/existingExercises}}

{{#customPrompt}}ADDITIONAL INSTRUCTIONS FROM TEACHER:
{{customPrompt}}{{/customPrompt}}

Return JSON:
{
  "exercises": [{
    "title": "Short display title",
    "instruction": "Read the text and write your response",
    "content": "The text passage or scenario",
    "options": null,
    "correctAnswer": "A model answer the student can compare against",
    "explanation": "What makes a good answer",
    "cefrLevel": "{{cefrLevel}}",
    "targetSkill": "writing",
    "needsAudio": false
  }]
}`,

  intro: `Generate {{count}} "Introduction" screen(s) in {{language}} at CEFR {{cefrLevel}} about "{{topic}}".

An introduction is a read-only presentation card that introduces the topic structure and key concepts. No interaction required from the student.

{{#sourceContent}}Source material:
{{sourceContent}}{{/sourceContent}}

{{#existingExercises}}EXISTING EXERCISES (pre-fetched via RAG):
Similarity levels: VERY_HIGH = near-duplicate, HIGH = very similar, MEDIUM = same topic area.
You MUST NOT duplicate VERY_HIGH or HIGH exercises. For MEDIUM, vary the specific content significantly.
If unsure whether your exercise duplicates an existing one, use the search_exercises tool to check.
---
{{existingExercises}}
---{{/existingExercises}}

{{#customPrompt}}ADDITIONAL INSTRUCTIONS FROM TEACHER:
{{customPrompt}}{{/customPrompt}}

Return JSON:
{
  "exercises": [{
    "title": "Topic title (e.g. Present Simple)",
    "instruction": "Brief description of what to review",
    "content": "Structured topic explanation with key points",
    "options": null,
    "correctAnswer": "",
    "explanation": "",
    "cefrLevel": "{{cefrLevel}}",
    "targetSkill": "reading",
    "needsAudio": false
  }]
}`,

  card: `Generate {{count}} "Concept Card" exercise(s) in {{language}} at CEFR {{cefrLevel}} about "{{topic}}".

A concept card is a read-only grammar/vocabulary card with structure, rules, and examples. Like a flashcard but richer.

{{#sourceContent}}Source material:
{{sourceContent}}{{/sourceContent}}

{{#existingExercises}}EXISTING EXERCISES (pre-fetched via RAG):
Similarity levels: VERY_HIGH = near-duplicate, HIGH = very similar, MEDIUM = same topic area.
You MUST NOT duplicate VERY_HIGH or HIGH exercises. For MEDIUM, vary the specific content significantly.
If unsure whether your exercise duplicates an existing one, use the search_exercises tool to check.
---
{{existingExercises}}
---{{/existingExercises}}

{{#customPrompt}}ADDITIONAL INSTRUCTIONS FROM TEACHER:
{{customPrompt}}{{/customPrompt}}

Return JSON:
{
  "exercises": [{
    "title": "Concept name (e.g. Irregular Verbs)",
    "instruction": "Short description of the concept",
    "content": "Explanation with structure, rules, and examples",
    "options": null,
    "correctAnswer": "",
    "explanation": "",
    "cefrLevel": "{{cefrLevel}}",
    "targetSkill": "grammar",
    "needsAudio": false
  }]
}`,

  tap_to_complete: `Generate {{count}} "Tap to Complete" exercise(s) in {{language}} at CEFR {{cefrLevel}} about "{{topic}}".

Each exercise has a sentence with one or more blanks (___) and a set of tappable word options. The student taps the correct option to fill each blank.

{{#sourceContent}}Source material:
{{sourceContent}}{{/sourceContent}}

{{#existingExercises}}EXISTING EXERCISES (pre-fetched via RAG):
Similarity levels: VERY_HIGH = near-duplicate, HIGH = very similar, MEDIUM = same topic area.
You MUST NOT duplicate VERY_HIGH or HIGH exercises. For MEDIUM, vary the specific content significantly.
If unsure whether your exercise duplicates an existing one, use the search_exercises tool to check.
---
{{existingExercises}}
---{{/existingExercises}}

{{#customPrompt}}ADDITIONAL INSTRUCTIONS FROM TEACHER:
{{customPrompt}}{{/customPrompt}}

Return JSON:
{
  "exercises": [{
    "title": "Short title (optional)",
    "instruction": "Tap the correct option to complete the sentence",
    "content": "She ___ to school every day.",
    "options": ["goes", "go", "going", "gone"],
    "correctAnswer": "goes",
    "explanation": "Third person singular requires 'goes' in present simple",
    "cefrLevel": "{{cefrLevel}}",
    "targetSkill": "grammar",
    "needsAudio": false
  }]
}

RULES:
- Always use ___ (three underscores) for blanks in content
- Provide 3-4 plausible options including the correct answer
- Distractors should be common mistakes for the CEFR level`,

  tap_to_order: `Generate {{count}} "Tap to Order" exercise(s) in {{language}} at CEFR {{cefrLevel}} about "{{topic}}".

Each exercise provides shuffled words that the student taps in order to form a correct sentence.

{{#sourceContent}}Source material:
{{sourceContent}}{{/sourceContent}}

{{#existingExercises}}EXISTING EXERCISES (pre-fetched via RAG):
Similarity levels: VERY_HIGH = near-duplicate, HIGH = very similar, MEDIUM = same topic area.
You MUST NOT duplicate VERY_HIGH or HIGH exercises. For MEDIUM, vary the specific content significantly.
If unsure whether your exercise duplicates an existing one, use the search_exercises tool to check.
---
{{existingExercises}}
---{{/existingExercises}}

{{#customPrompt}}ADDITIONAL INSTRUCTIONS FROM TEACHER:
{{customPrompt}}{{/customPrompt}}

Return JSON:
{
  "exercises": [{
    "title": "Short title (optional)",
    "instruction": "Put the words in the correct order",
    "content": "The correct sentence (hidden from student, used as reference)",
    "options": ["go", "I", "school", "to"],
    "correctAnswer": "I go to school",
    "explanation": "Subject + verb + prepositional phrase word order",
    "cefrLevel": "{{cefrLevel}}",
    "targetSkill": "grammar",
    "needsAudio": false
  }]
}

RULES:
- options must be the words shuffled (NOT in correct order)
- correctAnswer is the full correct sentence
- Keep sentences appropriate for the CEFR level`,

  listen_match: `Generate {{count}} "Listen & Match" exercise(s) in {{language}} at CEFR {{cefrLevel}} about "{{topic}}".

The student listens to audio and matches items together (word-definition pairs, etc.).

{{#sourceContent}}Source material:
{{sourceContent}}{{/sourceContent}}

{{#existingExercises}}EXISTING EXERCISES (pre-fetched via RAG):
Similarity levels: VERY_HIGH = near-duplicate, HIGH = very similar, MEDIUM = same topic area.
You MUST NOT duplicate VERY_HIGH or HIGH exercises. For MEDIUM, vary the specific content significantly.
If unsure whether your exercise duplicates an existing one, use the search_exercises tool to check.
---
{{existingExercises}}
---{{/existingExercises}}

{{#customPrompt}}ADDITIONAL INSTRUCTIONS FROM TEACHER:
{{customPrompt}}{{/customPrompt}}

Return JSON:
{
  "exercises": [{
    "title": "Short title (optional)",
    "instruction": "Listen and match the items",
    "content": "Description of matching pairs as text. Format: word1 = definition1 | word2 = definition2 | word3 = definition3",
    "options": ["word1", "word2", "word3"],
    "correctAnswer": "word1=definition1, word2=definition2, word3=definition3",
    "explanation": "Why these matches are correct",
    "cefrLevel": "{{cefrLevel}}",
    "targetSkill": "listening",
    "needsAudio": true
  }]
}`,

  listen_repeat: `Generate {{count}} "Listen & Repeat" exercise(s) in {{language}} at CEFR {{cefrLevel}} about "{{topic}}".

The student listens to a phrase/sentence and records themselves repeating it.

{{#sourceContent}}Source material:
{{sourceContent}}{{/sourceContent}}

{{#existingExercises}}EXISTING EXERCISES (pre-fetched via RAG):
Similarity levels: VERY_HIGH = near-duplicate, HIGH = very similar, MEDIUM = same topic area.
You MUST NOT duplicate VERY_HIGH or HIGH exercises. For MEDIUM, vary the specific content significantly.
If unsure whether your exercise duplicates an existing one, use the search_exercises tool to check.
---
{{existingExercises}}
---{{/existingExercises}}

{{#customPrompt}}ADDITIONAL INSTRUCTIONS FROM TEACHER:
{{customPrompt}}{{/customPrompt}}

Return JSON:
{
  "exercises": [{
    "title": "Short title (optional)",
    "instruction": "Listen and repeat the phrase",
    "content": "The phrase or sentence to be repeated",
    "options": null,
    "correctAnswer": "The exact text (same as content)",
    "explanation": "Pronunciation tips or key sounds to focus on",
    "cefrLevel": "{{cefrLevel}}",
    "targetSkill": "listening",
    "needsAudio": true
  }]
}`,

  watch_reflect: `Generate {{count}} "Watch & Reflect" exercise(s) in {{language}} at CEFR {{cefrLevel}} about "{{topic}}".

The student watches a video and writes a reflection or answers a question about it.

{{#sourceContent}}Source material:
{{sourceContent}}{{/sourceContent}}

{{#existingExercises}}EXISTING EXERCISES (pre-fetched via RAG):
Similarity levels: VERY_HIGH = near-duplicate, HIGH = very similar, MEDIUM = same topic area.
You MUST NOT duplicate VERY_HIGH or HIGH exercises. For MEDIUM, vary the specific content significantly.
If unsure whether your exercise duplicates an existing one, use the search_exercises tool to check.
---
{{existingExercises}}
---{{/existingExercises}}

{{#customPrompt}}ADDITIONAL INSTRUCTIONS FROM TEACHER:
{{customPrompt}}{{/customPrompt}}

Return JSON:
{
  "exercises": [{
    "title": "Short title (optional)",
    "instruction": "Watch the video and answer the question",
    "content": "The reflection question or prompt",
    "options": null,
    "correctAnswer": "A model answer",
    "explanation": "What makes a good reflection",
    "cefrLevel": "{{cefrLevel}}",
    "targetSkill": "writing",
    "needsAudio": false
  }]
}`,

  complete_chat: `Generate {{count}} "Complete Chat" exercise(s) in {{language}} at CEFR {{cefrLevel}} about "{{topic}}".

A chat conversation with blanks (___) in some messages. The student taps options to fill each blank.

{{#sourceContent}}Source material:
{{sourceContent}}{{/sourceContent}}

{{#existingExercises}}EXISTING EXERCISES (pre-fetched via RAG):
Similarity levels: VERY_HIGH = near-duplicate, HIGH = very similar, MEDIUM = same topic area.
You MUST NOT duplicate VERY_HIGH or HIGH exercises. For MEDIUM, vary the specific content significantly.
If unsure whether your exercise duplicates an existing one, use the search_exercises tool to check.
---
{{existingExercises}}
---{{/existingExercises}}

{{#customPrompt}}ADDITIONAL INSTRUCTIONS FROM TEACHER:
{{customPrompt}}{{/customPrompt}}

Return JSON:
{
  "exercises": [{
    "title": "Short title (optional)",
    "instruction": "Complete the conversation by selecting the correct responses",
    "content": "A: Hi, how are you?\\nB: ___\\nA: Great! What are you doing today?\\nB: ___",
    "options": ["I'm fine, thanks!", "I'm going shopping", "Not much", "See you later"],
    "correctAnswer": "I'm fine, thanks!|I'm going shopping",
    "explanation": "Natural conversational responses",
    "cefrLevel": "{{cefrLevel}}",
    "targetSkill": "vocabulary",
    "needsAudio": false
  }]
}

RULES:
- Use A: and B: prefixes for speakers
- Use ___ for blanks in B's lines
- correctAnswer uses | to separate multiple answers
- options should include correct answers plus plausible distractors`,

  write_complete: `Generate {{count}} "Write to Complete" exercise(s) in {{language}} at CEFR {{cefrLevel}} about "{{topic}}".

Text with blanks (___) where the student types the missing words/phrases. No options — free typing.

{{#sourceContent}}Source material:
{{sourceContent}}{{/sourceContent}}

{{#existingExercises}}EXISTING EXERCISES (pre-fetched via RAG):
Similarity levels: VERY_HIGH = near-duplicate, HIGH = very similar, MEDIUM = same topic area.
You MUST NOT duplicate VERY_HIGH or HIGH exercises. For MEDIUM, vary the specific content significantly.
If unsure whether your exercise duplicates an existing one, use the search_exercises tool to check.
---
{{existingExercises}}
---{{/existingExercises}}

{{#customPrompt}}ADDITIONAL INSTRUCTIONS FROM TEACHER:
{{customPrompt}}{{/customPrompt}}

Return JSON:
{
  "exercises": [{
    "title": "Short title (optional)",
    "instruction": "Write the missing words to complete the text",
    "content": "Yesterday I ___ to the store and ___ some groceries.",
    "options": null,
    "correctAnswer": "went|bought",
    "explanation": "Past simple of 'go' is 'went'; past simple of 'buy' is 'bought'",
    "cefrLevel": "{{cefrLevel}}",
    "targetSkill": "grammar",
    "needsAudio": false
  }]
}

RULES:
- Use ___ for each blank
- correctAnswer uses | to separate multiple answers in order
- Each blank should test a specific grammar point or vocabulary word`,

  listen_complete: `Generate {{count}} "Listen & Complete" exercise(s) in {{language}} at CEFR {{cefrLevel}} about "{{topic}}".

The student listens to audio of a conversation and completes blanks by selecting from options.

{{#sourceContent}}Source material:
{{sourceContent}}{{/sourceContent}}

{{#existingExercises}}EXISTING EXERCISES (pre-fetched via RAG):
Similarity levels: VERY_HIGH = near-duplicate, HIGH = very similar, MEDIUM = same topic area.
You MUST NOT duplicate VERY_HIGH or HIGH exercises. For MEDIUM, vary the specific content significantly.
If unsure whether your exercise duplicates an existing one, use the search_exercises tool to check.
---
{{existingExercises}}
---{{/existingExercises}}

{{#customPrompt}}ADDITIONAL INSTRUCTIONS FROM TEACHER:
{{customPrompt}}{{/customPrompt}}

Return JSON:
{
  "exercises": [{
    "title": "Short title (optional)",
    "instruction": "Listen and complete the conversation",
    "content": "A: Can I help you?\\nB: Yes, I'd like to ___ a table for two.\\nA: Of course. What ___ would you prefer?",
    "options": ["book", "reserve", "time", "day", "order", "place"],
    "correctAnswer": "book|time",
    "explanation": "To 'book a table' is a common collocation; 'time' completes the question about preference",
    "cefrLevel": "{{cefrLevel}}",
    "targetSkill": "listening",
    "needsAudio": true
  }]
}

RULES:
- Use A: and B: prefixes for speakers
- Use ___ for blanks
- correctAnswer uses | to separate multiple answers
- Provide more options than blanks (distractors)`,
};

// OpenAI function calling tool for RAG search
const EXERCISE_SEARCH_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "search_exercises",
    description: "Search the exercise database for exercises similar to a query. Use this to check if an exercise you're about to create already exists.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Describe the exercise you want to check for duplicates (e.g. 'fill in blanks about past tense irregular verbs')",
        },
      },
      required: ["query"],
    },
  },
};

const MAX_TOOL_CALLS = 3;

export async function generateExercisesByType(
  input: TypeGenerationInput
): Promise<TypeGenerationResult> {
  const allExercises: GeneratedExercise[] = [];
  let totalTokens = 0;

  for (const req of input.requests) {
    if (req.count <= 0) continue;

    const promptTemplate = EXERCISE_PROMPTS[req.type];
    if (!promptTemplate) {
      console.error(`No prompt found for exercise type: ${req.type}`);
      continue;
    }

    const vars: Record<string, string | undefined> = {
      count: String(req.count),
      topic: input.topic,
      language: input.language,
      cefrLevel: input.cefrLevel,
      sourceContent: input.sourceContent,
      customPrompt: input.customPrompt,
      existingExercises: input.existingSummaries?.length
        ? input.existingSummaries.join("\n")
        : undefined,
    };

    const interpolated = interpolateTemplate(promptTemplate, vars);

    const toolInstruction = input.searchCallback
      ? `\nYou have access to a search_exercises tool. Use it to verify if an exercise you're creating already exists in the database. Only search when you're uncertain — the pre-fetched list above covers the most similar exercises already.`
      : "";

    const systemPrompt = `You are a language exercise generator. ${interpolated}
${toolInstruction}
IMPORTANT RULES:
- Generate EXACTLY ${req.count} exercise(s), no more, no less
- "title" should be a short display title for the exercise
- "correctAnswer" is MANDATORY for every exercise (provide model answer for open-ended)
- "explanation" is MANDATORY (explain grammar rule, vocabulary usage, or reasoning)
- "instruction" must be a complete sentence explaining what to do
- "needsAudio": set to true only if the exercise type requires audio
- Return ONLY valid JSON with an "exercises" array, no markdown fences`;

    try {
      const useTools = !!input.searchCallback;
      const tools = useTools ? [EXERCISE_SEARCH_TOOL] : undefined;

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "user", content: systemPrompt },
      ];

      let parsed: Record<string, unknown> | null = null;

      for (let turn = 0; turn < MAX_TOOL_CALLS + 1; turn++) {
        const response = await getOpenAI().chat.completions.create({
          model: "gpt-4o-mini",
          messages,
          temperature: 0.7,
          // Can't use response_format with tools on the first call
          ...(tools && turn === 0 ? {} : { response_format: { type: "json_object" as const } }),
          ...(tools ? { tools, tool_choice: "auto" as const } : {}),
        });

        const choice = response.choices[0];
        totalTokens += response.usage?.total_tokens ?? 0;

        if (choice.finish_reason === "tool_calls" && choice.message.tool_calls?.length) {
          // GPT wants to search — process tool calls
          messages.push(choice.message);
          for (const tc of choice.message.tool_calls) {
            try {
              const args = JSON.parse(tc.function.arguments);
              const { results, tokensUsed } = await input.searchCallback!(args.query);
              totalTokens += tokensUsed;
              messages.push({ role: "tool", tool_call_id: tc.id, content: results });
            } catch (toolErr) {
              messages.push({ role: "tool", tool_call_id: tc.id, content: "Search failed. Continue generating exercises." });
              console.error("Tool call search failed:", toolErr);
            }
          }
          continue; // Next iteration with tool results
        }

        // GPT returned exercises content
        const content = choice.message.content ?? "{}";
        try {
          parsed = JSON.parse(content);
        } catch {
          // Try to extract JSON from the response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          }
        }
        break;
      }

      if (!parsed) continue;

      const exercises = (
        (parsed.exercises as Record<string, unknown>[]) ?? []
      ).map((e: Record<string, unknown>) => ({
        type: req.type,
        title: e.title ? String(e.title) : undefined,
        instruction: String(e.instruction ?? ""),
        content: String(e.content ?? ""),
        options: Array.isArray(e.options) ? e.options.map(String) : undefined,
        correctAnswer: String(e.correctAnswer ?? ""),
        explanation: String(e.explanation ?? ""),
        cefrLevel: String(e.cefrLevel ?? input.cefrLevel),
        targetSkill: String(e.targetSkill ?? "vocabulary"),
        needsAudio: Boolean(e.needsAudio ?? false),
      }));

      allExercises.push(...exercises);
    } catch (err) {
      console.error(`Failed to generate exercises for type ${req.type}:`, err);
    }
  }

  return { exercises: allExercises, tokensUsed: totalTokens };
}

// ─── Exercise Material Analysis ──────────────────────────

const EXERCISE_TYPE_DESCRIPTIONS = [
  "warm_up — Warm Up: Free text exercise from text, audio, or video",
  "intro — Introduction: Presentation screen for topic/structure overview (read-only)",
  "card — Concept Card: Grammar/concept card with structure and examples (read-only)",
  "tap_to_complete — Tap to Complete: Complete a sentence by tapping the correct option",
  "tap_to_order — Tap to Order: Reorder shuffled words to form a correct sentence",
  "listen_match — Listen & Match: Listen to audio and match items together",
  "listen_repeat — Listen & Repeat: Listen to audio and record yourself repeating it",
  "watch_reflect — Watch & Reflect: Watch a video and write a reflection",
  "complete_chat — Complete Chat: Fill in blanks within a chat conversation",
  "write_complete — Write to Complete: Type words/phrases to fill blanks in text",
  "listen_complete — Listen & Complete: Listen to audio and complete a conversation with blanks",
].join("\n");

export interface ExerciseAnalysisInput {
  materialText?: string;
  topic?: string;
  language: string;
  cefrLevel: string;
}

export interface ExerciseAnalysisResult {
  detectedTopic: string;
  suggestions: {
    type: string;
    count: number;
    reason: string;
  }[];
  materialSummary: string;
  tokensUsed: number;
}

export async function analyzeExerciseMaterial(
  input: ExerciseAnalysisInput
): Promise<ExerciseAnalysisResult> {
  const materialSection = input.materialText?.trim()
    ? `\nUploaded material:\n${input.materialText.slice(0, 12000)}\n`
    : "";

  const topicSection = input.topic?.trim()
    ? `\nUser-specified topic: ${input.topic}\n`
    : "";

  const prompt = `You are an expert language teaching exercise designer. Analyze the provided material and suggest an exercise generation plan.

Language: ${input.language}
CEFR Level: ${input.cefrLevel}
${topicSection}${materialSection}
Available exercise types:
${EXERCISE_TYPE_DESCRIPTIONS}

Return a JSON object with this exact structure:
{
  "detectedTopic": "The main topic detected from the material or user input",
  "materialSummary": "A 1-2 sentence summary of the uploaded content (empty string if no material)",
  "suggestions": [
    {
      "type": "exercise_type_slug",
      "count": 2,
      "reason": "Why this exercise type fits the material"
    }
  ]
}

Rules:
- suggestions: Pick from the available exercise types above. Use the exact slug values.
- Suggest 3-6 types with counts totaling 6-12 exercises.
- Include a mix of interactive and passive exercise types.
- If no material is provided, base suggestions on the topic and level alone.
- Return ONLY valid JSON.`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);
  const tokensUsed = response.usage?.total_tokens ?? 0;

  const validTypes = new Set(Object.keys(EXERCISE_PROMPTS));

  return {
    detectedTopic: String(parsed.detectedTopic ?? input.topic ?? ""),
    materialSummary: String(parsed.materialSummary ?? ""),
    suggestions: (parsed.suggestions ?? [])
      .filter((s: Record<string, unknown>) => validTypes.has(String(s.type ?? "")))
      .map((s: Record<string, unknown>) => ({
        type: String(s.type ?? ""),
        count: Number(s.count ?? 1),
        reason: String(s.reason ?? ""),
      })),
    tokensUsed,
  };
}

// ─── Progress Report Generation (Phase 4) ────────────────

export async function generateProgressReport(
  input: ProgressReportInput
): Promise<{ report: string; cefrEstimate: string; scores: Record<string, number> }> {
  const classData = input.classReports
    .map(
      (r) =>
        `Date: ${r.date}\nSummary: ${r.summary}\nNew vocabulary: ${r.vocabulary.map((v) => `${v.word} (${v.cefrLevel})`).join(", ")}\nGrammar errors: ${r.grammarErrors.length}\nStudent speaking ratio: ${Math.round(r.speakingMetrics.speakingRatio * 100)}%\nFiller words: ${r.speakingMetrics.fillerWordCount}`
    )
    .join("\n\n---\n\n");

  const prompt = `You are a language learning progress analyst. Generate a progress report for a student and return a JSON object with this structure:

{
  "report": "A comprehensive 3-5 paragraph progress report covering vocabulary growth, grammar improvement, speaking confidence, and areas to focus on. Write in a supportive, encouraging tone aimed at the student.",
  "cefrEstimate": "A1|A2|B1|B2|C1|C2",
  "scores": {
    "vocabulary": 0-100,
    "grammar": 0-100,
    "fluency": 0-100,
    "overall": 0-100
  }
}

Student: ${input.studentName}
Classroom: ${input.classroomName}
Language: ${input.language}
Period: ${input.periodStart.toISOString().split("T")[0]} to ${input.periodEnd.toISOString().split("T")[0]}
Current CEFR estimate: ${input.currentCefrEstimate ?? "Unknown"}
Number of sessions: ${input.classReports.length}

Session data:
${classData}

Return ONLY valid JSON, no markdown fences or extra text.`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);

  return {
    report: String(parsed.report ?? ""),
    cefrEstimate: String(parsed.cefrEstimate ?? input.currentCefrEstimate ?? "A1"),
    scores: {
      vocabulary: Number(parsed.scores?.vocabulary ?? 0),
      grammar: Number(parsed.scores?.grammar ?? 0),
      fluency: Number(parsed.scores?.fluency ?? 0),
      overall: Number(parsed.scores?.overall ?? 0),
    },
  };
}
