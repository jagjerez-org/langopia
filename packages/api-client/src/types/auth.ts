import type { AcademyType } from "@langopia/shared/types";

// ─── Requests ───────────────────────────────────────

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  academyName?: string;
  academyType?: AcademyType;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// ─── Responses ──────────────────────────────────────

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    plan: string;
  };
}
