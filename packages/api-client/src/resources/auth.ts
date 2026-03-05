import type { LangopiaClient } from "../client";
import type {
  RegisterRequest,
  LoginRequest,
  RefreshTokenRequest,
  AuthResponse,
} from "../types";

export class AuthResource {
  constructor(private client: LangopiaClient) {}

  register(data: RegisterRequest): Promise<AuthResponse> {
    return this.client.request({
      method: "POST",
      path: "/auth/register",
      auth: "none",
      body: data,
    });
  }

  login(data: LoginRequest): Promise<AuthResponse> {
    return this.client.request({
      method: "POST",
      path: "/auth/login",
      auth: "none",
      body: data,
    });
  }

  refresh(data: RefreshTokenRequest): Promise<AuthResponse> {
    return this.client.request({
      method: "POST",
      path: "/auth/refresh",
      auth: "none",
      body: data,
    });
  }
}
