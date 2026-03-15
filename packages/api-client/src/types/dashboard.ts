// ─── Requests ───────────────────────────────────────

export interface DashboardUsageParams {
  period?: string; // YYYY-MM
}

// ─── Responses ──────────────────────────────────────

export interface DashboardOverview {
  totalAcademies: number;
  totalRooms: number;
  totalReports: number;
  totalClassHours: number;
  totalTokens: number;
}

export interface DashboardActivityDay {
  date: string;
  classes: number;
  hours: number;
}

export interface DashboardUsageResponse {
  period: string;
  plan: string;
  usage: Record<string, number>;
  limits: {
    maxClassesPerMonth: number;
    maxClassHoursPerMonth: number;
    maxReportsPerMonth: number;
    maxStudentsPerRoom: number;
    maxStorageBytes: number;
    maxAiTokensPerMonth: number;
  };
}
