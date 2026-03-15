import type { CourseStatus } from "@langopia/shared/types";
import type { PaginationParams } from "./common";

// ─── Requests ───────────────────────────────────────

export interface CreateCourseRequest {
  title: string;
  language: string;
  cefrLevel: string;
  description?: string;
  thumbnailUrl?: string;
  estimatedHours?: number;
}

export interface UpdateCourseRequest {
  title?: string;
  description?: string;
  language?: string;
  cefrLevel?: string;
  thumbnailUrl?: string;
  estimatedHours?: number;
  status?: CourseStatus;
}

export interface QueryCoursesParams extends PaginationParams {
  language?: string;
  cefrLevel?: string;
  status?: CourseStatus | string;
  search?: string;
}

export interface ManageCourseLessonsRequest {
  lessons: Array<{
    lessonId: string;
    sortOrder: number;
    moduleTitle?: string;
    moduleOrder?: number;
  }>;
}

export interface GenerateCourseRequest {
  prompt: string;
  language?: string;
  cefrLevel?: string;
}

export interface RefineCourseRequest {
  currentPlan: {
    suggestedTitle: string;
    modules: Array<{
      title: string;
      lessons: Array<{ suggestedTitle: string; matchedLessonId?: string }>;
    }>;
  };
  userMessage: string;
  language?: string;
  cefrLevel?: string;
}

// ─── Responses ──────────────────────────────────────

export interface CourseResponse {
  id: string;
  title: string;
  description: string | null;
  language: string;
  cefrLevel: string;
  thumbnailUrl: string | null;
  estimatedHours: number | null;
  status: CourseStatus;
  academyId: string;
  lessonCount?: number;
  courseLessons?: Array<{
    id: string;
    sortOrder: number;
    moduleTitle?: string | null;
    moduleOrder?: number;
    lesson: {
      id: string;
      title: string;
      status: string;
    };
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CourseLessonSuggestion {
  suggestedTitle: string;
  matchedLesson: {
    id: string;
    title: string;
    status: string;
    exerciseCount: number;
  } | null;
  matchScore: number;
}

export interface CourseModuleSuggestion {
  title: string;
  lessons: CourseLessonSuggestion[];
}

export interface GenerateCourseResponse {
  suggestedTitle: string;
  suggestedDescription: string;
  language: string;
  cefrLevel: string;
  estimatedHours: number;
  noLessonsAvailable: boolean;
  modules: CourseModuleSuggestion[];
  aiResponse?: string;
}
