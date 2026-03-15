// ─── Requests ───────────────────────────────────────

export interface CreateAcademyLevelRequest {
  code: string;
  label: string;
  sortOrder?: number;
}

export interface UpdateAcademyLevelRequest {
  label?: string;
  sortOrder?: number;
}

// ─── Responses ──────────────────────────────────────

export interface AcademyLevelResponse {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
  academyId: string;
  createdAt: string;
}
