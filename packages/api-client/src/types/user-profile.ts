// ─── Requests ───────────────────────────────────────

export interface UpdateProfileRequest {
  name: string;
}

export interface RegisterPushTokenRequest {
  token: string;
  platform: "ios" | "android" | "web";
}

export interface UnregisterPushTokenRequest {
  token: string;
}

// ─── Responses ──────────────────────────────────────

export interface ProfileResponse {
  name: string;
}

export interface FullProfileResponse {
  id: string;
  email: string;
  name: string;
  plan: string;
}
