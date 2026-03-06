// ─── Requests ───────────────────────────────────────

export interface UpdateAcademyLandingRequest {
  logoUrl?: string;
  primaryColor?: string;
  backgroundColor?: string;
  heroTitle?: string;
  heroDescription?: string;
  heroImageUrl?: string;
  showPlans?: boolean;
  showTeacherApplication?: boolean;
  isPublished?: boolean;
}

// ─── Responses ──────────────────────────────────────

export interface AcademyLandingResponse {
  id: string;
  academyId: string;
  logoUrl: string | null;
  primaryColor: string;
  backgroundColor: string;
  heroTitle: string | null;
  heroDescription: string | null;
  heroImageUrl: string | null;
  showPlans: boolean;
  showTeacherApplication: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}
