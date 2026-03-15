import type { LangopiaClient } from "../client";
import type {
  CheckoutRequest,
  CheckoutResponse,
  PortalResponse,
  ConnectOnboardRequest,
  ConnectOnboardResponse,
  ConnectStatusResponse,
} from "../types";

export class StripeResource {
  constructor(private client: LangopiaClient) {}

  checkout(data: CheckoutRequest): Promise<CheckoutResponse> {
    return this.client.request({
      method: "POST",
      path: "/stripe/checkout",
      auth: "jwt",
      body: data,
    });
  }

  portal(): Promise<PortalResponse> {
    return this.client.request({
      method: "POST",
      path: "/stripe/portal",
      auth: "jwt",
    });
  }

  connectOnboard(data: ConnectOnboardRequest): Promise<ConnectOnboardResponse> {
    return this.client.request({
      method: "POST",
      path: "/stripe/connect/onboard",
      auth: "jwt",
      body: data,
    });
  }

  connectStatus(academyId: string): Promise<ConnectStatusResponse> {
    return this.client.request({
      method: "GET",
      path: `/stripe/connect/status/${academyId}`,
      auth: "jwt",
    });
  }
}
