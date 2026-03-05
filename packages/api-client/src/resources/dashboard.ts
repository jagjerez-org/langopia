import type { LangopiaClient } from "../client";
import type { DashboardOverview } from "../types";

export class DashboardResource {
  constructor(private client: LangopiaClient) {}

  overview(): Promise<DashboardOverview> {
    return this.client.request({
      method: "GET",
      path: "/dashboard/overview",
      auth: "jwt",
    });
  }
}
