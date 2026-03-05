"use client";

import { useMemo } from "react";
import { LangopiaClient } from "@langopia/api-client";
import { useAuth } from "@/components/auth-provider";
import { useAcademy } from "@/components/academy-provider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:2501";

/**
 * Returns a configured LangopiaClient instance.
 *
 * - JWT auth (accessToken/refreshToken) comes from AuthProvider
 * - API key comes from the currently selected academy
 * - Both are optional — the client works for whichever auth mode is needed
 */
export function useApiClient(): LangopiaClient {
  const { accessToken, refreshToken } = useAuth();
  const { selectedAcademyData } = useAcademy();

  const apiKey = selectedAcademyData?.apiKey;

  return useMemo(
    () =>
      new LangopiaClient({
        baseUrl: API_URL,
        accessToken: accessToken ?? undefined,
        refreshToken: refreshToken ?? undefined,
        apiKey,
      }),
    [accessToken, refreshToken, apiKey],
  );
}

/**
 * Lightweight variant for pages that only need API-key auth (v1/* endpoints).
 * Does not depend on auth session — only needs useAcademy.
 */
export function useApiKeyClient(): LangopiaClient {
  const { selectedAcademyData } = useAcademy();
  const apiKey = selectedAcademyData?.apiKey;

  return useMemo(
    () =>
      new LangopiaClient({
        baseUrl: API_URL,
        apiKey,
      }),
    [apiKey],
  );
}

/**
 * Create a client with no auth — for room-internal and auth endpoints.
 */
export function createPublicClient(): LangopiaClient {
  return new LangopiaClient({
    baseUrl: API_URL,
  });
}
