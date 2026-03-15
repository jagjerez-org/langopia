// ─── Requests ───────────────────────────────────────

export interface FinancingsQueryParams {
  period?: "daily" | "monthly" | "quarterly" | "annual";
  date?: string;
}

// ─── Responses ──────────────────────────────────────

export interface FinancingsOverviewResponse {
  revenue: number;
  revenuePrevious: number;
  activeSubscriptions: number;
  activeSubscriptionsPrevious: number;
  inactiveSubscriptions: number;
  inactiveSubscriptionsPrevious: number;
  overdueSubscriptions: number;
  overdueSubscriptionsPrevious: number;
  byPlan: Array<{
    planId: string;
    planName: string;
    revenue: number;
    activeCount: number;
  }>;
}

export interface RevenueChartResponse {
  data: Array<{
    date: string;
    revenue: number;
  }>;
}
