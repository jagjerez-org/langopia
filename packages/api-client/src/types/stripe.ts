// ─── Requests ───────────────────────────────────────

export interface CheckoutRequest {
  plan: string;
}

// ─── Responses ──────────────────────────────────────

export interface CheckoutResponse {
  url: string;
}

export interface PortalResponse {
  url: string;
}

export interface ConnectOnboardRequest {
  academyId: string;
}

export interface ConnectOnboardResponse {
  url: string;
}

export interface ConnectStatusResponse {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}
