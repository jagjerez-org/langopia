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

export interface CreateLessonVersionRequest {
  note?: string;
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

export interface LessonVersionSummary {
  id: string;
  lessonId: string;
  version: number;
  title: string;
  status: string;
  createdAt: string;
}

export interface LessonVersionResponse {
  id: string;
  lessonId: string;
  version: number;
  title: string;
  description: string | null;
  language: string;
  cefrLevel: string;
  status: string;
  exerciseSnapshot: Record<string, unknown>[];
  createdAt: string;
}

export interface LessonKpisResponse {
  classCount: number;
  studentCount: number;
  completionRate: number;
  averageScore: number;
}
