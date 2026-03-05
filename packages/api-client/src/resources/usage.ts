import type { LangopiaClient } from "../client";
import type { QueryUsageParams, UsageResponse } from "../types";

export class UsageResource {
  constructor(private client: LangopiaClient) {}

  get(params?: QueryUsageParams): Promise<UsageResponse> {
    return this.client.request({
      method: "GET",
      path: "/v1/usage",
      auth: "apikey",
      query: params as Record<string, unknown>,
    });
  }
}
