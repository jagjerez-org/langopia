import type { PaginationParams } from "./common";

// ─── Requests ───────────────────────────────────────

export interface QueryStudentsParams extends PaginationParams {
  search?: string;
}

// ─── Responses ──────────────────────────────────────

export interface StudentResponse {
  id: string;
  email: string;
  name: string | null;
  academyId: string;
  totalClasses: number;
  lastClassAt: string | null;
  createdAt: string;
}

export interface StudentDetailResponse extends StudentResponse {
  participations: Array<{
    classId: string;
    classTitle: string;
    scheduledAt: string;
    status: string;
  }>;
}
