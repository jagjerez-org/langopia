import type { LearningPathStatus } from "@langopia/shared/types";
import type { PaginationParams } from "./common";
import type { LessonResponse } from "./lessons";

// ─── Requests ───────────────────────────────────────

export interface CreateLearningPathRequest {
  title: string;
  cefrLevel: string;
  language?: string;
  description?: string;
  thumbnailUrl?: string;
  estimatedHours?: number;
}

export interface UpdateLearningPathRequest {
  title?: string;
  description?: string;
  language?: string;
  cefrLevel?: string;
  thumbnailUrl?: string;
  estimatedHours?: number;
  status?: LearningPathStatus;
}

export interface QueryLearningPathsParams extends PaginationParams {
  language?: string;
  cefrLevel?: string;
  status?: LearningPathStatus | string;
}

export interface AddLessonsRequest {
  lessonId?: string;
  lessonIds?: string[];
}

export interface ReorderLessonsRequest {
  lessonIds: string[];
}

// ─── Responses ──────────────────────────────────────

export interface ReorderCoursesRequest {
  courseIds: string[];
}

// ─── Responses ──────────────────────────────────────

export interface LearningPathResponse {
  id: string;
  title: string;
  description: string | null;
  cefrLevel: string;
  language: string;
  status: LearningPathStatus;
  thumbnailUrl: string | null;
  estimatedHours: number | null;
  academyId: string;
  lessonCount?: number;
  courseCount?: number;
  lessons?: LessonResponse[];
  createdAt: string;
  updatedAt: string;
}
