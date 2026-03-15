"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { AcademyInfo } from "@langopia/api-client";
import { getApiClient } from "./api";

interface AcademyContextValue {
  academy: AcademyInfo | null;
  loading: boolean;
  error: string | null;
}

const AcademyContext = createContext<AcademyContextValue>({
  academy: null,
  loading: true,
  error: null,
});

export function useAcademy() {
  return useContext(AcademyContext);
}

function resolveAcademySlug(): string | null {
  if (typeof window === "undefined") return null;

  // Check URL query param first (dev fallback)
  const params = new URLSearchParams(window.location.search);
  const querySlug = params.get("academy");
  if (querySlug) return querySlug;

  // Check subdomain: [slug].student.langopia.com
  const hostname = window.location.hostname;
  const parts = hostname.split(".");
  if (parts.length >= 3 && parts[1] === "student") {
    return parts[0];
  }

  // Check localStorage for previously resolved academy
  const stored = localStorage.getItem("academy_data");
  if (stored) {
    try {
      const data = JSON.parse(stored);
      return data.slug || null;
    } catch {
      return null;
    }
  }

  return null;
}

export function AcademyProvider({ children }: { children: ReactNode }) {
  const [academy, setAcademy] = useState<AcademyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const slug = resolveAcademySlug();
    if (!slug) {
      setLoading(false);
      setError("No academy found. Use ?academy=slug parameter.");
      return;
    }

    const client = getApiClient();
    client.studentApp
      .resolveAcademy(slug)
      .then((data) => {
        setAcademy(data);
        localStorage.setItem("academy_data", JSON.stringify(data));
      })
      .catch(() => {
        setError("Academy not found");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AcademyContext.Provider value={{ academy, loading, error }}>
      {children}
    </AcademyContext.Provider>
  );
}
