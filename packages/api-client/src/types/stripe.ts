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
