import type { ClassStatus, ClassType, ClassStudentStatus } from "@langopia/shared/types";
import type { PaginationParams } from "./common";

// ─── Requests ───────────────────────────────────────

export interface CreateClassRequest {
  title: string;
  description?: string;
  scheduledAt: string;
  durationMinutes?: number;
  classType?: ClassType | string;
  language?: string;
  maxStudents?: number;
  lessonId?: string;
  courseId?: string;
  teacherId?: string;
  studentEmails?: string[];
  cancellationMinutes?: number;
  zoomLink?: string;
}

export interface UpdateClassRequest {
  title?: string;
  description?: string;
  scheduledAt?: string;
  durationMinutes?: number;
  maxStudents?: number;
  lessonId?: string | null;
  courseId?: string | null;
  teacherId?: string | null;
  zoomLink?: string | null;
}

export interface QueryClassesParams extends PaginationParams {
  status?: ClassStatus | string;
  from?: string;
  to?: string;
  teacherId?: string;
  classType?: ClassType | string;
}

export interface CancelClassRequest {
  reason?: string;
}

// ─── Responses ──────────────────────────────────────

export interface ClassStudentResponse {
  id: string;
  email: string;
  name: string | null;
  status: ClassStudentStatus;
}

export interface ClassResponse {
  id: string;
  title: string;
  description: string | null;
  scheduledAt: string;
  durationMinutes: number;
  classType: ClassType;
  language: string;
  maxStudents: number;
  status: ClassStatus;
  teacherUrl: string;
  studentUrl: string;
  cancellationMinutes: number;
  lessonId: string | null;
  courseId: string | null;
  teacherId: string | null;
  roomId: string | null;
  zoomLink: string | null;
  students: ClassStudentResponse[];
  createdAt: string;
  updatedAt: string;
}
