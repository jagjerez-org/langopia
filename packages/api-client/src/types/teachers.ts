import type { AcademyRole } from "@langopia/shared/types";

// ─── Requests ───────────────────────────────────────

export interface InviteTeacherRequest {
  email: string;
}

// ─── Responses ──────────────────────────────────────

export interface TeacherResponse {
  id: string;
  userId: string;
  email: string;
  name: string;
  roles: AcademyRole[];
  createdAt: string;
}

export interface InviteTeacherResponse {
  id: string;
  email: string;
  roles: AcademyRole[];
}
