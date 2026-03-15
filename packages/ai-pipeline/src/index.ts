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
  tokensUsed: number;
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
): Promise<{ segments: TranscriptionSegment[]; tokensUsed: number }> {
  if (segments.length === 0) return { segments, tokensUsed: 0 };

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

    const tokensUsed = response.usage?.total_tokens ?? 0;
    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    const speakers: string[] = parsed.speakers ?? [];

    return {
      segments: segments.map((seg, i) => ({
        ...seg,
        speaker: (speakers[i] === "student" ? "student" : "teacher") as "teacher" | "student",
      })),
      tokensUsed,
    };
  } catch {
    // Fallback: return segments unchanged
    return { segments, tokensUsed: 0 };
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
  transcription: TranscriptionResult & { chatText?: string }
): Promise<AnalysisResult> {
  const speakingMetrics = computeSpeakingMetrics(transcription);

  const chatSection = transcription.chatText
    ? `\n\nChat Messages:\n${transcription.chatText}`
    : "";

  const prompt = `You are a language learning analyst. Analyze this class transcription${transcription.chatText ? " and chat messages" : ""} and return a JSON object with exactly this structure:

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
- Provide 3-5 concrete, actionable suggestions for the student${transcription.chatText ? "\n- Also analyze the chat messages for vocabulary usage and grammar errors from students" : ""}
- The language detected is: ${transcription.language}
- Return ONLY valid JSON, no markdown fences or extra text

Transcription:
${transcription.segments.map((s) => `[${s.speaker}] ${s.text}`).join("\n")}${chatSection}`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const tokensUsed = response.usage?.total_tokens ?? 0;
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
    tokensUsed,
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

  podcast: `Generate {{count}} "Podcast" exercise(s) in {{language}} at CEFR {{cefrLevel}} about "{{topic}}".

A podcast exercise presents a transcript of a podcast conversation between HOST and GUEST, followed by comprehension questions. Audio will be generated from the transcript automatically.

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
    "title": "Episode title",
    "instruction": "Listen to the podcast and answer the comprehension questions",
    "content": "HOST: Welcome to our show...\\nGUEST: Thanks for having me...\\nHOST: So tell us about...\\nGUEST: Well, ...\\n---QUESTIONS---\\n1. What did the guest say about X?\\na) option A\\nb) option B\\nc) option C\\n2. Why did the host mention Y?\\na) option A\\nb) option B\\nc) option C",
    "options": ["option A", "option B", "option C", "option A", "option B", "option C"],
    "correctAnswer": "b|a",
    "explanation": "Q1: The guest mentioned... because... | Q2: The host brought up Y to...",
    "cefrLevel": "{{cefrLevel}}",
    "targetSkill": "listening",
    "needsAudio": true
  }]
}

RULES:
- Transcript must use HOST: and GUEST: prefixes
- Transcript should be 150-300 words, natural and conversational
- Separate transcript from questions with ---QUESTIONS---
- Generate 3-5 multiple choice questions with 3 options each (a/b/c)
- options[] should contain ALL options flattened in order
- correctAnswer uses | to separate answers (one letter per question)
- explanation uses | to separate explanations per question`,

  guided_story: `Generate {{count}} "Guided Story" exercise(s) in {{language}} at CEFR {{cefrLevel}} about "{{topic}}".

A guided story presents a narrative with blanks (___) for vocabulary/grammar practice and decision points [CHOICE:n] where the student picks a story direction.

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
    "title": "Story title",
    "instruction": "Read the story, fill in the blanks and make choices to continue",
    "content": "Once upon a time, a young traveler ___ through a dark forest. The trees were tall and the path was narrow.\\n\\n[CHOICE:1]\\na) Follow the river downstream\\nb) Climb the nearest hill\\nc) Set up camp and wait\\n\\nAfter making a decision, the traveler ___ something unexpected.",
    "options": ["walked", "found"],
    "correctAnswer": "walked|a|found|b",
    "explanation": "Past simple of 'walk' fits the narrative tense. 'Found' continues the past narrative.",
    "cefrLevel": "{{cefrLevel}}",
    "targetSkill": "writing",
    "needsAudio": false
  }]
}

RULES:
- Use ___ for fill-in blanks (vocabulary/grammar)
- Use [CHOICE:n] followed by a), b), c) for decision points
- options[] contains ONLY the correct words for blanks (NOT choice options)
- correctAnswer: blank answers and choice letters intercalated in order of appearance, separated by |
- Story should be 200-400 words with 2-3 blanks and 1-2 decision points
- Keep the narrative engaging and age-appropriate`,

  guided_conversation: `Generate {{count}} "Guided Conversation" exercise(s) in {{language}} at CEFR {{cefrLevel}} about "{{topic}}".

A guided conversation simulates a real dialogue where the student fills in their part (YOU:). Speaker A provides context, and the student responds naturally.

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
    "title": "Conversation scenario title",
    "instruction": "Complete the conversation by writing your responses",
    "content": "A: Good morning! Welcome to Café Roma. What can I get you?\\nYOU: ___\\nA: Great choice! Would you like that for here or to go?\\nYOU: ___\\nA: Sure. That'll be $4.50. Cash or card?\\nYOU: ___",
    "options": ["(order a coffee)", "(say for here or to go)", "(choose payment method)"],
    "correctAnswer": "I'd like a cappuccino, please.|For here, please.|I'll pay by card.",
    "explanation": "Ordering at a café: Use 'I'd like...' for polite requests. 'For here' vs 'to go' is standard café vocabulary. 'I'll pay by...' is the natural way to state payment preference.",
    "cefrLevel": "{{cefrLevel}}",
    "targetSkill": "writing",
    "needsAudio": false
  }]
}

RULES:
- Use A: for the other speaker and YOU: for the student's lines
- Each YOU: line should contain ___ as placeholder
- options[] contains contextual hints for each blank (in parentheses)
- correctAnswer: model answers separated by | in order
- 4-6 student turns (YOU: lines)
- Scenario should feel realistic and practical
- Hints should guide without giving away the exact answer`,
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
  "podcast — Podcast: Listen to a podcast episode and answer comprehension questions",
  "guided_story — Guided Story: Participate in a story with decision points and fill-in blanks",
  "guided_conversation — Guided Conversation: Practice a conversation by filling in your part of the dialogue",
].join("\n");

export interface ExerciseAnalysisInput {
  materialText?: string;
  topic?: string;
  language: string;
  cefrLevel: string;
}

export interface ExerciseAnalysisResult {
  detectedTopic: string;
  detectedLanguage: string;
  detectedCefrLevel: string;
  suggestedTitle: string;
  suggestedDescription: string;
  suggestions: {
    type: string;
    count: number;
    reason: string;
    description: string;
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
  "detectedLanguage": "ISO 639-1 language code detected from the material (e.g. en, es, fr, de, pt, it, zh, ja, ko, ar)",
  "detectedCefrLevel": "MUST match the provided CEFR Level. Only estimate from material if no level was provided (A1, A2, B1, B2, C1, C2)",
  "suggestedTitle": "A concise, descriptive lesson title based on the material/topic (e.g. 'Business Negotiations - Making Offers')",
  "suggestedDescription": "A 1-2 sentence lesson description explaining what students will learn",
  "materialSummary": "A 1-2 sentence summary of the uploaded content (empty string if no material)",
  "suggestions": [
    {
      "type": "exercise_type_slug",
      "count": 2,
      "reason": "Why this exercise type fits the material",
      "description": "A brief preview of this exercise from the student's perspective (e.g. 'You will listen to a short dialogue about ordering food and answer comprehension questions')"
    }
  ]
}

Rules:
- suggestions: Pick from the available exercise types above. Use the exact slug values.
- Suggest 3-6 types with counts totaling 6-12 exercises.
- Include a mix of interactive and passive exercise types.
- description: Write a 1-sentence preview of what the student will actually do in this exercise. Be specific to the topic and material.
- If no material is provided, base suggestions on the topic and level alone.
- detectedLanguage: Detect from material content. If no material, use the provided language.
- detectedCefrLevel: ALWAYS use the provided CEFR Level above. Only estimate if the provided level is empty or missing.
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
    detectedLanguage: String(parsed.detectedLanguage ?? input.language ?? ""),
    detectedCefrLevel: String(parsed.detectedCefrLevel ?? input.cefrLevel ?? ""),
    suggestedTitle: String(parsed.suggestedTitle ?? parsed.detectedTopic ?? input.topic ?? ""),
    suggestedDescription: String(parsed.suggestedDescription ?? parsed.materialSummary ?? ""),
    materialSummary: String(parsed.materialSummary ?? ""),
    suggestions: (parsed.suggestions ?? [])
      .filter((s: Record<string, unknown>) => validTypes.has(String(s.type ?? "")))
      .map((s: Record<string, unknown>) => ({
        type: String(s.type ?? ""),
        count: Number(s.count ?? 1),
        reason: String(s.reason ?? ""),
        description: String(s.description ?? ""),
      })),
    tokensUsed,
  };
}

// ─── Plan Refinement (Chat-based) ────────────────────────

export interface PlanRefinementInput {
  currentPlan: {
    detectedTopic: string;
    materialSummary: string;
    suggestions: { type: string; count: number; reason: string; description?: string }[];
  };
  userMessage: string;
  language: string;
  cefrLevel: string;
  materialText?: string;
}

export interface PlanRefinementResult {
  detectedTopic: string;
  materialSummary: string;
  suggestions: { type: string; count: number; reason: string; description: string }[];
  aiResponse: string;
  tokensUsed: number;
}

export async function refineExercisePlan(
  input: PlanRefinementInput
): Promise<PlanRefinementResult> {
  const materialSection = input.materialText?.trim()
    ? `\nMaterial context:\n${input.materialText.slice(0, 8000)}\n`
    : "";

  const prompt = `You are an expert language teaching exercise designer helping a teacher refine their exercise plan through conversation.

Language: ${input.language}
CEFR Level: ${input.cefrLevel}
${materialSection}
Current exercise plan:
${JSON.stringify(input.currentPlan, null, 2)}

Available exercise types:
${EXERCISE_TYPE_DESCRIPTIONS}

The teacher says: "${input.userMessage}"

Return a JSON object with this exact structure:
{
  "detectedTopic": "Updated topic (or same if unchanged)",
  "materialSummary": "Updated summary (or same if unchanged)",
  "suggestions": [
    {
      "type": "exercise_type_slug",
      "count": 2,
      "reason": "Why this exercise type fits",
      "description": "A brief preview of this exercise from the student's perspective"
    }
  ],
  "aiResponse": "Your conversational reply to the teacher explaining what you changed and why. Be concise, friendly, and helpful."
}

Rules:
- Interpret the teacher's message and adjust the plan accordingly
- If they ask to add/remove exercise types, modify the suggestions array
- If they adjust counts, update the counts
- If they mention a different topic focus, update detectedTopic
- Keep suggestions using valid exercise type slugs from the list above
- suggestions should total 4-15 exercises
- description: Write a 1-sentence preview of what the student will actually do in this exercise. Be specific to the topic and material.
- aiResponse should be 1-3 sentences explaining the changes
- Return ONLY valid JSON`;

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
    detectedTopic: String(parsed.detectedTopic ?? input.currentPlan.detectedTopic),
    materialSummary: String(parsed.materialSummary ?? input.currentPlan.materialSummary),
    suggestions: (parsed.suggestions ?? input.currentPlan.suggestions)
      .filter((s: Record<string, unknown>) => validTypes.has(String(s.type ?? "")))
      .map((s: Record<string, unknown>) => ({
        type: String(s.type ?? ""),
        count: Number(s.count ?? 1),
        reason: String(s.reason ?? ""),
        description: String(s.description ?? ""),
      })),
    aiResponse: String(parsed.aiResponse ?? "Plan updated."),
    tokensUsed,
  };
}

// ─── Exercise Refinement (Chat-based, operates on generated exercises) ────

export interface ExerciseRefinementInput {
  currentExercises: {
    tempId: string;
    type: string;
    title?: string;
    instruction: string;
    content: string;
    options?: string[];
    correctAnswer: string;
    explanation: string;
    cefrLevel: string;
    targetSkill: string;
  }[];
  userMessage: string;
  language: string;
  cefrLevel: string;
  materialText?: string;
  topic?: string;
}

export interface ExerciseRefinementResult {
  exercises: {
    tempId: string;
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
  }[];
  aiResponse: string;
  tokensUsed: number;
}

export async function refineExercises(
  input: ExerciseRefinementInput
): Promise<ExerciseRefinementResult> {
  const materialSection = input.materialText?.trim()
    ? `\nMaterial context:\n${input.materialText.slice(0, 8000)}\n`
    : "";

  const topicSection = input.topic ? `Topic: ${input.topic}\n` : "";

  const prompt = `You are an expert language teaching exercise designer helping a teacher refine their generated exercises through conversation.

Language: ${input.language}
CEFR Level: ${input.cefrLevel}
${topicSection}${materialSection}
Current exercises:
${JSON.stringify(input.currentExercises, null, 2)}

Available exercise types:
${EXERCISE_TYPE_DESCRIPTIONS}

The teacher says: "${input.userMessage}"

Return a JSON object with this exact structure:
{
  "exercises": [
    {
      "tempId": "keep existing tempId for modified exercises, generate new UUID for added exercises",
      "type": "exercise_type_slug",
      "title": "Exercise title",
      "instruction": "What the student should do",
      "content": "The exercise content/text",
      "options": ["option1", "option2"],
      "correctAnswer": "The correct answer",
      "explanation": "Why this is the correct answer",
      "cefrLevel": "${input.cefrLevel}",
      "targetSkill": "vocabulary|grammar|reading|listening|writing|speaking|pronunciation",
      "needsAudio": false
    }
  ],
  "aiResponse": "Your conversational reply explaining what you changed."
}

Rules:
- Interpret the teacher's message and modify exercises accordingly
- You can add, remove, or modify exercises
- When modifying an existing exercise, keep its tempId
- When adding a new exercise, generate a new UUID v4 for tempId
- Keep exercises using valid exercise type slugs from the list above
- Keep total exercise count between 3 and 20
- aiResponse should be 1-3 sentences explaining the changes
- Return ONLY valid JSON`;

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
    exercises: (parsed.exercises ?? input.currentExercises).map(
      (e: Record<string, unknown>) => ({
        tempId: String(e.tempId ?? crypto.randomUUID()),
        type: validTypes.has(String(e.type ?? "")) ? String(e.type) : "card",
        title: e.title ? String(e.title) : undefined,
        instruction: String(e.instruction ?? ""),
        content: String(e.content ?? ""),
        options: Array.isArray(e.options) ? e.options.map(String) : undefined,
        correctAnswer: String(e.correctAnswer ?? ""),
        explanation: String(e.explanation ?? ""),
        cefrLevel: String(e.cefrLevel ?? input.cefrLevel),
        targetSkill: String(e.targetSkill ?? "vocabulary"),
        needsAudio: Boolean(e.needsAudio),
      })
    ),
    aiResponse: String(parsed.aiResponse ?? "Exercises updated."),
    tokensUsed,
  };
}

// ─── Course Plan Generation ───────────────────────────────

export interface CoursePlanLesson {
  id: string;
  title: string;
  description: string | null;
  status: string;
  exerciseCount: number;
}

export interface CoursePlanInput {
  prompt: string;
  language: string;
  cefrLevel: string;
  existingLessons: CoursePlanLesson[];
}

export interface CourseLessonSuggestion {
  suggestedTitle: string;
  matchedLesson: { id: string; title: string; status: string; exerciseCount: number } | null;
  matchScore: number;
}

export interface CourseModuleSuggestion {
  title: string;
  lessons: CourseLessonSuggestion[];
}

export interface CoursePlanResult {
  suggestedTitle: string;
  suggestedDescription: string;
  language: string;
  cefrLevel: string;
  estimatedHours: number;
  noLessonsAvailable: boolean;
  modules: CourseModuleSuggestion[];
  tokensUsed: number;
}

export async function generateCoursePlan(
  input: CoursePlanInput
): Promise<CoursePlanResult> {
  const lessonsContext = input.existingLessons.length > 0
    ? `\nAvailable lessons in the academy (id | title | description | status | exercises):\n${input.existingLessons.map((l) => `- ${l.id} | ${l.title} | ${l.description ?? "no description"} | ${l.status} | ${l.exerciseCount} exercises`).join("\n")}\n`
    : "\nNo existing lessons available in this academy.\n";

  const prompt = `You are an expert language curriculum designer. Create a structured course plan based on the teacher's description.

Language: ${input.language}
CEFR Level: ${input.cefrLevel}
${lessonsContext}
Teacher's request: "${input.prompt}"

Return a JSON object with this exact structure:
{
  "suggestedTitle": "Course title",
  "suggestedDescription": "A 1-2 sentence description of the course",
  "estimatedHours": 10,
  "modules": [
    {
      "title": "Module 1 title",
      "lessons": [
        {
          "suggestedTitle": "What this lesson slot should cover",
          "matchedLessonId": "uuid-of-best-matching-lesson-or-null",
          "matchScore": 0.85
        }
      ]
    }
  ]
}

Rules:
- Organize the course into 2-6 logical modules
- Each module should have 2-5 lessons
- For each lesson slot, find the best matching existing lesson by semantic similarity of title/description
- matchedLessonId: set to the lesson id if there's a good match (score >= 0.3), null otherwise
- matchScore: 0-1 indicating how well the existing lesson matches the suggested slot (0 if no match)
- Do NOT reuse the same lesson id in multiple slots
- suggestedTitle: describe what the lesson should cover even if no match exists
- estimatedHours: realistic total hours for the entire course
- Return ONLY valid JSON, no markdown fences`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);
  const tokensUsed = response.usage?.total_tokens ?? 0;

  // Build lookup for validation
  const lessonMap = new Map(input.existingLessons.map((l) => [l.id, l]));
  const usedIds = new Set<string>();

  const modules: CourseModuleSuggestion[] = (parsed.modules ?? []).map(
    (mod: Record<string, unknown>) => ({
      title: String(mod.title ?? "Untitled Module"),
      lessons: (
        (mod.lessons as Record<string, unknown>[]) ?? []
      ).map((lesson) => {
        const matchId = lesson.matchedLessonId as string | null;
        const matched = matchId && lessonMap.has(matchId) && !usedIds.has(matchId)
          ? lessonMap.get(matchId)!
          : null;
        if (matched) usedIds.add(matched.id);
        return {
          suggestedTitle: String(lesson.suggestedTitle ?? ""),
          matchedLesson: matched
            ? { id: matched.id, title: matched.title, status: matched.status, exerciseCount: matched.exerciseCount }
            : null,
          matchScore: matched ? Number(lesson.matchScore ?? 0) : 0,
        };
      }),
    }),
  );

  return {
    suggestedTitle: String(parsed.suggestedTitle ?? "Untitled Course"),
    suggestedDescription: String(parsed.suggestedDescription ?? ""),
    language: input.language,
    cefrLevel: input.cefrLevel,
    estimatedHours: Number(parsed.estimatedHours ?? 0),
    noLessonsAvailable: input.existingLessons.length === 0,
    modules,
    tokensUsed,
  };
}

export interface CoursePlanRefinementInput {
  currentPlan: {
    suggestedTitle: string;
    modules: Array<{
      title: string;
      lessons: Array<{ suggestedTitle: string; matchedLessonId?: string }>;
    }>;
  };
  userMessage: string;
  language: string;
  cefrLevel: string;
  existingLessons: CoursePlanLesson[];
}

export async function refineCoursePlan(
  input: CoursePlanRefinementInput
): Promise<CoursePlanResult & { aiResponse: string }> {
  const lessonsContext = input.existingLessons.length > 0
    ? `\nAvailable lessons (id | title | description | status | exercises):\n${input.existingLessons.map((l) => `- ${l.id} | ${l.title} | ${l.description ?? "no description"} | ${l.status} | ${l.exerciseCount} exercises`).join("\n")}\n`
    : "\nNo existing lessons available.\n";

  const prompt = `You are an expert language curriculum designer helping a teacher refine their course plan through conversation.

Language: ${input.language}
CEFR Level: ${input.cefrLevel}
${lessonsContext}
Current course plan:
${JSON.stringify(input.currentPlan, null, 2)}

The teacher says: "${input.userMessage}"

Return a JSON object with this exact structure:
{
  "suggestedTitle": "Updated course title",
  "suggestedDescription": "Updated description",
  "estimatedHours": 10,
  "modules": [
    {
      "title": "Module title",
      "lessons": [
        {
          "suggestedTitle": "Lesson slot description",
          "matchedLessonId": "uuid-or-null",
          "matchScore": 0.85
        }
      ]
    }
  ],
  "aiResponse": "Your conversational reply explaining what you changed and why."
}

Rules:
- Interpret the teacher's message and adjust the plan accordingly
- If they ask to add/remove modules or lessons, modify the structure
- For each lesson slot, match to the best available existing lesson
- matchedLessonId: lesson id if good match, null otherwise
- Do NOT reuse the same lesson id in multiple slots
- aiResponse: 1-3 sentences explaining changes
- Return ONLY valid JSON`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);
  const tokensUsed = response.usage?.total_tokens ?? 0;

  const lessonMap = new Map(input.existingLessons.map((l) => [l.id, l]));
  const usedIds = new Set<string>();

  const modules: CourseModuleSuggestion[] = (parsed.modules ?? []).map(
    (mod: Record<string, unknown>) => ({
      title: String(mod.title ?? "Untitled Module"),
      lessons: (
        (mod.lessons as Record<string, unknown>[]) ?? []
      ).map((lesson) => {
        const matchId = lesson.matchedLessonId as string | null;
        const matched = matchId && lessonMap.has(matchId) && !usedIds.has(matchId)
          ? lessonMap.get(matchId)!
          : null;
        if (matched) usedIds.add(matched.id);
        return {
          suggestedTitle: String(lesson.suggestedTitle ?? ""),
          matchedLesson: matched
            ? { id: matched.id, title: matched.title, status: matched.status, exerciseCount: matched.exerciseCount }
            : null,
          matchScore: matched ? Number(lesson.matchScore ?? 0) : 0,
        };
      }),
    }),
  );

  return {
    suggestedTitle: String(parsed.suggestedTitle ?? input.currentPlan.suggestedTitle),
    suggestedDescription: String(parsed.suggestedDescription ?? ""),
    language: input.language,
    cefrLevel: input.cefrLevel,
    estimatedHours: Number(parsed.estimatedHours ?? 0),
    noLessonsAvailable: input.existingLessons.length === 0,
    modules,
    aiResponse: String(parsed.aiResponse ?? "Plan updated."),
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

// ─── Content Suggestions (End of Class) ─────────────────

export interface ContentSuggestionsInput {
  transcriptText: string;
  chatText: string;
  language: string;
  academyId: string;
}

export interface ContentSuggestion {
  type: "topic" | "vocabulary" | "grammar";
  title: string;
  description: string;
  keywords: string[];
}

export async function generateContentSuggestions(
  input: ContentSuggestionsInput,
): Promise<Record<string, unknown>[]> {
  const sessionContent = [
    input.transcriptText ? `Transcription:\n${input.transcriptText}` : "",
    input.chatText ? `Chat Messages:\n${input.chatText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!sessionContent.trim()) {
    return [];
  }

  const prompt = `You are a language teaching assistant analyzing a class session in ${input.language}.
Based on the session content below, identify the key topics, vocabulary areas, and grammar patterns that were discussed or practiced.

Return a JSON object with this structure:
{
  "suggestions": [
    {
      "type": "topic" | "vocabulary" | "grammar",
      "title": "Brief title for the suggestion",
      "description": "Why this is relevant based on the session",
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }
  ]
}

Rules:
- Identify 3-6 suggestions covering topics, vocabulary themes, and grammar areas
- Keywords should be useful for searching existing lesson/course content
- Focus on areas where students showed weakness or interest
- Return ONLY valid JSON

Session content:
${sessionContent.slice(0, 8000)}`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    return (parsed.suggestions ?? []) as Record<string, unknown>[];
  } catch {
    return [];
  }
}
