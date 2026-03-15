import type { LangopiaClient } from "../client";
import type { DashboardOverview, DashboardActivityDay, DashboardUsageParams, DashboardUsageResponse } from "../types";

export class DashboardResource {
  constructor(private client: LangopiaClient) {}

  overview(): Promise<DashboardOverview> {
    return this.client.request({
      method: "GET",
      path: "/dashboard/overview",
      auth: "jwt",
    });
  }

  activity(days?: number): Promise<DashboardActivityDay[]> {
    return this.client.request({
      method: "GET",
      path: "/dashboard/activity",
      auth: "jwt",
      query: days ? ({ days } as Record<string, unknown>) : undefined,
    });
  }

  usage(academyId: string, params?: DashboardUsageParams): Promise<DashboardUsageResponse> {
    return this.client.request({
      method: "GET",
      path: "/dashboard/usage",
      auth: "jwt",
      query: { academyId, ...params } as Record<string, unknown>,
    });
  }
}
