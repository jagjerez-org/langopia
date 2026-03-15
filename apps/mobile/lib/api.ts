import { useMemo } from "react";
import { LangopiaClient } from "@langopia/api-client";
import { useAuth } from "@/lib/auth-context";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:2501";

/**
 * JWT-only LangopiaClient — mirrors web's useJwtClient().
 * Use for user-scoped endpoints.
 */
export function useApiClient(): LangopiaClient {
  const { accessToken, refreshToken } = useAuth();

  return useMemo(
    () =>
      new LangopiaClient({
        baseUrl: API_URL,
        accessToken: accessToken ?? undefined,
        refreshToken: refreshToken ?? undefined,
      }),
    [accessToken, refreshToken],
  );
}

/**
 * No-auth client for room-internal endpoints (join, chat, end).
 * Mirrors web's createPublicClient().
 */
export function createPublicRoomClient(): LangopiaClient {
  return new LangopiaClient({ baseUrl: API_URL });
}
