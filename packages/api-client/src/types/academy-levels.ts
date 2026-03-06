// ─── Requests ───────────────────────────────────────

export interface CreateAcademyLevelRequest {
  code: string;
  name: string;
  sortOrder?: number;
}

export interface UpdateAcademyLevelRequest {
  name?: string;
  sortOrder?: number;
}

// ─── Responses ──────────────────────────────────────

export interface AcademyLevelResponse {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  academyId: string;
  createdAt: string;
}
