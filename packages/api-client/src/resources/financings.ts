import type { LangopiaClient } from "../client";
import type {
  FinancingsQueryParams,
  FinancingsOverviewResponse,
  RevenueChartResponse,
  StudentSubscriptionResponse,
} from "../types";

export class FinancingsResource {
  constructor(private client: LangopiaClient) {}

  overview(academyId: string, params?: FinancingsQueryParams): Promise<FinancingsOverviewResponse> {
    return this.client.request({
      method: "GET",
      path: `/academies/${academyId}/financings/overview`,
      auth: "jwt",
      query: params as Record<string, unknown>,
    });
  }

  subscriptions(academyId: string, params?: FinancingsQueryParams): Promise<StudentSubscriptionResponse[]> {
    return this.client.request({
      method: "GET",
      path: `/academies/${academyId}/financings/subscriptions`,
      auth: "jwt",
      query: params as Record<string, unknown>,
    });
  }

  revenueChart(academyId: string, params?: FinancingsQueryParams): Promise<RevenueChartResponse> {
    return this.client.request({
      method: "GET",
      path: `/academies/${academyId}/financings/revenue-chart`,
      auth: "jwt",
      query: params as Record<string, unknown>,
    });
  }
}
