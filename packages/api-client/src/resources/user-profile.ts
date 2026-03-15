import type { LangopiaClient } from "../client";
import type {
  UpdateProfileRequest,
  ProfileResponse,
  FullProfileResponse,
  RegisterPushTokenRequest,
  UnregisterPushTokenRequest,
} from "../types";

export class UserProfileResource {
  constructor(private client: LangopiaClient) {}

  getProfile(): Promise<FullProfileResponse> {
    return this.client.request({
      method: "GET",
      path: "/user/profile",
      auth: "jwt",
    });
  }

  update(data: UpdateProfileRequest): Promise<ProfileResponse> {
    return this.client.request({
      method: "PATCH",
      path: "/user/profile",
      auth: "jwt",
      body: data,
    });
  }

  registerPushToken(data: RegisterPushTokenRequest): Promise<{ success: boolean }> {
    return this.client.request({
      method: "POST",
      path: "/user/push-tokens",
      auth: "jwt",
      body: data,
    });
  }

  unregisterPushToken(data: UnregisterPushTokenRequest): Promise<{ success: boolean }> {
    return this.client.request({
      method: "DELETE",
      path: "/user/push-tokens",
      auth: "jwt",
      body: data,
    });
  }
}
