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
  const file = new File([arrayBuffer], "recording.mp4", {
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

// ─── Exercise Generation (Phase 6) ────────────────────────

export interface ExerciseGenerationInput {
  studentName: string;
  language: string;
  cefrLevel: string | null;
  vocabularyBank: { word: string; cefrLevel: string; context: string }[];
  grammarPatterns: { rule: string; example: string; correction: string }[];
  recentSuggestions: string[];
  sourceContent?: string;
}

export interface ExerciseGenerationResult {
  exercises: GeneratedExercise[];
  tokensUsed: number;
}

export interface GeneratedExercise {
  type: "fill_in_blank" | "multiple_choice" | "sentence_reorder" | "error_correction" | "free_response";
  instruction: string;
  content: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  cefrLevel: string;
  targetSkill: "vocabulary" | "grammar" | "reading" | "writing";
}

export async function generateExercises(
  input: ExerciseGenerationInput
): Promise<ExerciseGenerationResult> {
  const vocabSample = input.vocabularyBank.slice(-20).map((v) => `${v.word} (${v.cefrLevel}): "${v.context}"`).join("\n");
  const grammarSample = input.grammarPatterns.slice(-10).map((g) => `Rule: ${g.rule} | Error: "${g.example}" → "${g.correction}"`).join("\n");

  const sourceSection = input.sourceContent?.trim()
    ? `\nSource material (use this as the basis for generating exercises):\n${input.sourceContent.slice(0, 8000)}\n`
    : "";

  const prompt = `You are a language exercise generator for ${input.language} learners. Generate 6 exercises based on the student's learning profile.

Return a JSON object:
{
  "exercises": [
    {
      "type": "fill_in_blank" | "multiple_choice" | "sentence_reorder" | "error_correction" | "free_response",
      "instruction": "Clear instruction for the student",
      "content": "The exercise content (sentence with ___ for fill-in, etc.)",
      "options": ["option1", "option2", "option3", "option4"],
      "correctAnswer": "The correct answer",
      "explanation": "Why this is correct, referencing the grammar rule or vocabulary",
      "cefrLevel": "A1|A2|B1|B2|C1|C2",
      "targetSkill": "vocabulary" | "grammar" | "reading" | "writing"
    }
  ]
}

Student: ${input.studentName}
CEFR Level: ${input.cefrLevel ?? "Unknown"}

Recent vocabulary:
${vocabSample || "No vocabulary data yet"}

Grammar patterns to practice:
${grammarSample || "No grammar data yet"}

Teacher suggestions:
${input.recentSuggestions.join("\n") || "None"}
${sourceSection}
Rules:
- Generate exactly 6 exercises: 2 vocabulary, 2 grammar, 1 reading, 1 writing
- Match difficulty to the student's CEFR level (${input.cefrLevel ?? "B1"})
- For multiple_choice, always provide exactly 4 options
- For fill_in_blank, use ___ in the content to mark the blank
- Make exercises contextual and relevant to the student's recent learning
- Return ONLY valid JSON`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);
  const tokensUsed = response.usage?.total_tokens ?? 0;

  const exercises = (parsed.exercises ?? []).map((e: Record<string, unknown>) => ({
    type: String(e.type ?? "multiple_choice"),
    instruction: String(e.instruction ?? ""),
    content: String(e.content ?? ""),
    options: Array.isArray(e.options) ? e.options.map(String) : undefined,
    correctAnswer: String(e.correctAnswer ?? ""),
    explanation: String(e.explanation ?? ""),
    cefrLevel: String(e.cefrLevel ?? input.cefrLevel ?? "B1"),
    targetSkill: String(e.targetSkill ?? "vocabulary"),
  }));

  return { exercises, tokensUsed };
}

// ─── Template-based Exercise Generation ──────────────────

export interface TemplateExerciseRequest {
  templateSlug: string;
  promptTemplate: string;
  count: number;
}

export interface TemplateGenerationInput {
  requests: TemplateExerciseRequest[];
  language: string;
  cefrLevel: string;
  topic: string;
  sourceContent?: string;
}

export interface TemplateGenerationResult {
  exercises: (GeneratedExercise & { templateSlug: string })[];
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

export async function generateExercisesFromTemplates(
  input: TemplateGenerationInput
): Promise<TemplateGenerationResult> {
  const allExercises: (GeneratedExercise & { templateSlug: string })[] = [];
  let totalTokens = 0;

  const vars: Record<string, string | undefined> = {
    topic: input.topic,
    language: input.language,
    cefrLevel: input.cefrLevel,
    sourceContent: input.sourceContent,
  };

  for (const req of input.requests) {
    if (req.count <= 0) continue;

    vars.count = String(req.count);
    const interpolated = interpolateTemplate(req.promptTemplate, vars);

    const systemPrompt = `You are a language exercise generator. ${interpolated}

Generate exactly ${req.count} exercise(s). Return ONLY valid JSON with this structure:
{ "exercises": [{ "instruction": "...", "content": "...", "options": [...] or null, "correctAnswer": "...", "explanation": "...", "cefrLevel": "${input.cefrLevel}", "targetSkill": "..." }] }`;

    try {
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: systemPrompt }],
        temperature: 0.7,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(content);
      totalTokens += response.usage?.total_tokens ?? 0;

      const exercises = (parsed.exercises ?? []).map(
        (e: Record<string, unknown>) => ({
          type: req.templateSlug,
          instruction: String(e.instruction ?? ""),
          content: String(e.content ?? ""),
          options: Array.isArray(e.options) ? e.options.map(String) : undefined,
          correctAnswer: String(e.correctAnswer ?? ""),
          explanation: String(e.explanation ?? ""),
          cefrLevel: String(e.cefrLevel ?? input.cefrLevel),
          targetSkill: String(e.targetSkill ?? "vocabulary"),
          templateSlug: req.templateSlug,
        })
      );

      allExercises.push(...exercises);
    } catch (err) {
      console.error(
        `Failed to generate exercises for template ${req.templateSlug}:`,
        err
      );
    }
  }

  return { exercises: allExercises, tokensUsed: totalTokens };
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
