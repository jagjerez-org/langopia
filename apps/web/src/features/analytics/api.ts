import { api } from "../../lib/api-client.js";

export type NpsView = {
  score: number | null;
  respondents: number;
  promoters: number;
  passives: number;
  detractors: number;
};

export type TeacherQualityView = {
  teacherProfileId: string;
  teacherName: string;
  responses: number;
  averageCsat: number | null;
  negativeReviewsPending: number;
};

export type ChurnRiskReason =
  | "low_attendance"
  | "consecutive_absences"
  | "stale_evaluation"
  | "low_progress_rating"
  | "recent_negative_review"
  | "past_due_invoice"
  | "detractor_nps";

export type StudentAtRiskView = {
  studentId: string;
  name: string;
  level: "low" | "medium" | "high";
  score: number;
  reasons: ChurnRiskReason[];
  signals: {
    attendanceRateLast4Weeks: number | null;
    consecutiveAbsences: number;
    weeksWithoutEvaluation: number | null;
    lastProgressRating: number | null;
    recentNegativeReviewRating: number | null;
    hasPastDueInvoice: boolean;
    latestNpsScore: number | null;
  };
};

export type TeacherProductivityView = {
  teacherProfileId: string;
  teacherName: string;
  scheduledHours: number;
  contractedHours: number;
  occupancyRate: number;
  sessionCount: number;
  studentsWithoutEvaluation: number;
  studentsWithoutEvaluationNames: string[];
  averageCsat: number | null;
  csatResponses: number;
  materialReviews: number;
  averageMaterialReview: number | null;
  pendingNegativeMaterialReviews: number;
  lateStartedSessions: number;
  completedSessions: number;
  unsignedCorrectionsOlderThan7Days: number;
};

export type McpAuthorizationView = {
  authorizationId: string;
  clientName: string;
  clientKind: string;
  memberName: string;
  scopes: string[];
  status: "active" | "expired" | "revoked";
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
};

export function defaultAnalyticsRange(now = new Date()): { from: string; to: string } {
  const to = now.toISOString();
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - 90);
  return { from: fromDate.toISOString(), to };
}

function periodQuery(range: { from: string; to: string }): string {
  return new URLSearchParams(range).toString();
}

export function getNps(range: { from: string; to: string }): Promise<NpsView> {
  return api.get<NpsView>(`/feedback/nps?${periodQuery(range)}`);
}

export function getTeacherQuality(range: { from: string; to: string }): Promise<TeacherQualityView[]> {
  return api.get<TeacherQualityView[]>(`/feedback/teacher-quality?${periodQuery(range)}`);
}

export function getTeacherProductivity(range: { from: string; to: string }): Promise<TeacherProductivityView[]> {
  return api.get<TeacherProductivityView[]>(`/feedback/teacher-productivity?${periodQuery(range)}`);
}

export function getStudentsAtRisk(): Promise<StudentAtRiskView[]> {
  return api.get<StudentAtRiskView[]>("/feedback/students-at-risk");
}

export function listMcpAuthorizations(): Promise<McpAuthorizationView[]> {
  return api.get<McpAuthorizationView[]>("/mcp/oauth/authorizations");
}

export function revokeMcpAuthorization(authorizationId: string): Promise<{ revoked: true }> {
  return api.post<{ revoked: true }>(`/mcp/oauth/authorizations/${authorizationId}/revoke`);
}
