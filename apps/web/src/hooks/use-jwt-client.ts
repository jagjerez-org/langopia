"use client";

import { useMemo } from "react";
import { LangopiaClient } from "@langopia/api-client";
import { useAuth } from "@/components/auth-provider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:2501";

/**
 * JWT-only LangopiaClient — no AcademyProvider dependency.
 * Use for user-scoped endpoints (me/*).
 */
export function useJwtClient(): LangopiaClient {
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
