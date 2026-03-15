import type { ExerciseType, ExerciseSource, TargetSkill } from "@langopia/shared/types";
import type { PaginationParams } from "./common";

// ─── Requests ───────────────────────────────────────

export interface ExercisePlanItem {
  type: ExerciseType | string;
  count: number;
}

export interface CreateExerciseRequest {
  topic: string;
  language?: string;
  cefrLevel?: string;
  materialContext?: string;
  mediaItemIds?: string[];
  lessonId?: string;
  exercises: ExercisePlanItem[];
}

export interface QueryExercisesParams extends PaginationParams {
  source?: ExerciseSource | string;
  language?: string;
  cefrLevel?: string;
}

export interface SearchExercisesRequest {
  query: string;
  limit?: number;
  language?: string;
  cefrLevel?: string;
  targetSkill?: TargetSkill | string;
  excludeIds?: string[];
  mode?: "topic" | "content";
  distanceThreshold?: number;
}

export interface AnalyzeExerciseRequest {
  topic?: string;
  language?: string;
  cefrLevel?: string;
  materialContext?: string;
  mediaItemIds?: string[];
}

export interface UpdateExerciseRequest {
  title?: string;
  instruction?: string;
  content?: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  cefrLevel?: string;
  targetSkill?: TargetSkill | string;
  topic?: string;
  videoUrl?: string;
  imageUrl?: string;
}

export interface RegenerateExerciseRequest {
  customPrompt?: string;
}

export interface CreateSingleExerciseRequest {
  mode: "prompt" | "manual";
  language: string;
  cefrLevel: string;
  prompt?: string;
  topic?: string;
  type?: ExerciseType | string;
  targetSkill?: TargetSkill | string;
  title?: string;
  instruction?: string;
  content?: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  videoUrl?: string;
  imageUrl?: string;
}

export interface RefinePlanRequest {
  currentPlan: {
    detectedTopic: string;
    materialSummary: string;
    suggestions: { type: string; count: number; reason: string; description?: string }[];
  };
  userMessage: string;
  language?: string;
  cefrLevel?: string;
  materialContext?: string;
  mediaItemIds?: string[];
}

export interface RefinePlanResponse {
  detectedTopic: string;
  materialSummary: string;
  suggestions: AnalyzeExerciseSuggestion[];
  aiResponse: string;
}

// ─── Responses ──────────────────────────────────────

export interface ExerciseResponse {
  id: string;
  type: ExerciseType;
  source: ExerciseSource;
  title: string;
  instruction: string;
  content: string;
  options: string[] | null;
  correctAnswer: string | null;
  explanation: string | null;
  cefrLevel: string;
  targetSkill: TargetSkill | null;
  topic: string | null;
  language: string;
  videoUrl: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  lesson?: { id: string; title: string } | null;
  academyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyzeExistingExercise {
  id: string;
  type: string;
  title?: string | null;
  targetSkill: string;
  topic: string | null;
  language: string;
  instruction: string;
  content: string;
  options: string[] | null;
  correctAnswer?: string;
  explanation?: string;
  cefrLevel: string;
  audioUrl?: string | null;
  distance: number;
  matchType: "topic" | "content";
  similarity: "very_high" | "high" | "medium";
}

export interface AnalyzeExerciseSuggestion {
  type: string;
  count: number;
  reason: string;
  description: string;
}

export interface AnalyzeExerciseResponse {
  detectedTopic: string;
  detectedLanguage: string;
  detectedCefrLevel: string;
  suggestedTitle: string;
  suggestedDescription: string;
  materialSummary: string;
  suggestions: AnalyzeExerciseSuggestion[];
  existingExercises?: AnalyzeExistingExercise[];
}

// ─── Preview (generate without saving) ─────────────

export interface PreviewExercise {
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
}

export interface PreviewExercisesRequest {
  topic?: string;
  language?: string;
  cefrLevel?: string;
  materialContext?: string;
  mediaItemIds?: string[];
  exercises?: ExercisePlanItem[];
}

export interface PreviewExercisesResponse {
  detectedTopic: string;
  detectedLanguage: string;
  detectedCefrLevel: string;
  suggestedTitle: string;
  suggestedDescription: string;
  materialSummary: string;
  existingExercises?: AnalyzeExistingExercise[];
  exercises: PreviewExercise[];
}

export interface RefinePreviewRequest {
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
  language?: string;
  cefrLevel?: string;
  materialContext?: string;
  topic?: string;
}

export interface RefinePreviewResponse {
  exercises: PreviewExercise[];
  aiResponse: string;
}

export interface BulkSaveExercisesRequest {
  lessonId?: string;
  topic?: string;
  exercises: {
    type: string;
    title?: string;
    targetSkill: string;
    instruction: string;
    content: string;
    options?: string[];
    correctAnswer: string;
    explanation: string;
    cefrLevel: string;
    language: string;
    needsAudio?: boolean;
  }[];
}
