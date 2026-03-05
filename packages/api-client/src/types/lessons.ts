import type { LessonStatus } from "@langopia/shared/types";
import type { PaginationParams } from "./common";
import type { ExercisePlanItem, ExerciseResponse } from "./exercises";

// ─── Requests ───────────────────────────────────────

export interface CreateLessonRequest {
  title: string;
  cefrLevel: string;
  language?: string;
  description?: string;
}

export interface UpdateLessonRequest {
  title?: string;
  description?: string;
  status?: LessonStatus;
}

export interface QueryLessonsParams extends PaginationParams {
  language?: string;
  cefrLevel?: string;
  status?: LessonStatus | string;
}

export interface GenerateLessonExercisesRequest {
  exercises: ExercisePlanItem[];
  topic?: string;
}

export interface LinkExercisesRequest {
  exerciseIds: string[];
}

export interface QueryLessonExercisesParams {
  limit?: string;
  offset?: string;
}

// ─── Responses ──────────────────────────────────────

export interface LessonResponse {
  id: string;
  title: string;
  description: string | null;
  cefrLevel: string;
  language: string;
  status: LessonStatus;
  academyId: string;
  exerciseCount?: number;
  exercises?: ExerciseResponse[];
  createdAt: string;
  updatedAt: string;
}
