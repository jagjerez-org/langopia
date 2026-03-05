import type { UserPlan, UsageMetric } from "@langopia/shared/types";

// ─── Requests ───────────────────────────────────────

export interface QueryUsageParams {
  period?: string; // YYYY-MM
}

// ─── Responses ──────────────────────────────────────

export interface UsageResponse {
  period: string;
  plan: UserPlan;
  usage: Record<UsageMetric, number>;
  limits: {
    maxRoomsPerMonth: number;
    maxClassHoursPerMonth: number;
    maxReportsPerMonth: number;
    maxStudentsPerRoom: number;
    maxStorageBytes: number;
    maxAiTokensPerMonth: number;
  };
}
