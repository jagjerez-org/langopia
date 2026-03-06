// ─── Requests ───────────────────────────────────────

export interface CreateAcademyLanguageRequest {
  code: string;
  name: string;
  sortOrder?: number;
}

export interface UpdateAcademyLanguageRequest {
  name?: string;
  sortOrder?: number;
}

// ─── Responses ──────────────────────────────────────

export interface AcademyLanguageResponse {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  academyId: string;
  createdAt: string;
}
