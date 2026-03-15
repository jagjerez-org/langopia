"use client";

import { LangopiaClient } from "@langopia/api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:2501";

let clientInstance: LangopiaClient | null = null;

export function getApiClient(): LangopiaClient {
  if (!clientInstance) {
    clientInstance = new LangopiaClient({
      baseUrl: API_URL,
      onTokenRefresh: (tokens) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("student_access_token", tokens.accessToken);
          localStorage.setItem("student_refresh_token", tokens.refreshToken);
        }
      },
    });

    // Restore tokens from storage
    if (typeof window !== "undefined") {
      const accessToken = localStorage.getItem("student_access_token");
      const refreshToken = localStorage.getItem("student_refresh_token");
      if (accessToken) {
        clientInstance.setTokens(accessToken, refreshToken || undefined);
      }
    }
  }

  return clientInstance;
}

export function setAuthTokens(accessToken: string, refreshToken: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("student_access_token", accessToken);
    localStorage.setItem("student_refresh_token", refreshToken);
  }
  getApiClient().setTokens(accessToken, refreshToken);
}

export function clearAuthTokens() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("student_access_token");
    localStorage.removeItem("student_refresh_token");
    localStorage.removeItem("student_data");
    localStorage.removeItem("academy_data");
  }
  clientInstance = null;
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("student_access_token");
}
