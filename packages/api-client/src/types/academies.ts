import type { AcademyType } from "@langopia/shared/types";

// ─── Requests ───────────────────────────────────────

export interface CreateAcademyRequest {
  name: string;
  academyType?: AcademyType;
}

export interface UpdateAcademyRequest {
  name?: string;
  logoUrl?: string;
  settings?: Record<string, unknown>;
}

// ─── Responses ──────────────────────────────────────

export interface AcademyResponse {
  id: string;
  name: string;
  academyType: AcademyType;
  apiKey: string | null;
  settings: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}
