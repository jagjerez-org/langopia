import type { TeacherApplicationStatus } from "@langopia/shared/types";

// ─── Requests ───────────────────────────────────────

export interface SubmitApplicationRequest {
  fullName: string;
  email: string;
  phone?: string;
  languages?: string[];
  experience?: string;
  cvUrl?: string;
  attachments?: string[];
  customFields?: Record<string, unknown>;
}

export interface ReviewApplicationRequest {
  status: TeacherApplicationStatus | string;
  reviewNotes?: string;
}

export interface CreateCustomFieldRequest {
  label: string;
  fieldType?: string;
  isRequired?: boolean;
  options?: string[];
  sortOrder?: number;
}

// ─── Responses ──────────────────────────────────────

export interface TeacherApplicationResponse {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  languages: string[];
  experience: string | null;
  cvUrl: string | null;
  attachments: string[];
  customFields: Record<string, unknown>;
  status: TeacherApplicationStatus;
  reviewNotes: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  academyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationCustomFieldResponse {
  id: string;
  label: string;
  fieldType: string;
  isRequired: boolean;
  options: string[];
  sortOrder: number;
  academyId: string;
}
