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
}

export interface AnalyzeExerciseResponse {
  detectedTopic: string;
  materialSummary: string;
  suggestions: AnalyzeExerciseSuggestion[];
  existingExercises?: AnalyzeExistingExercise[];
}
