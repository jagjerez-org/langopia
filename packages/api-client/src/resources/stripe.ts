import type { LangopiaClient } from "../client";
import type {
  CheckoutRequest,
  CheckoutResponse,
  PortalResponse,
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
}
