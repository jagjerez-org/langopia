"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth-provider";
import { LangopiaClient } from "@langopia/api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:2501";

export interface AcademyData {
  id: string;
  name: string;
  slug: string;
  role: string;
  roles: string[];
  academyType: string;
  apiKey?: string;
  createdAt: string;
}

interface AcademyContextValue {
  academies: AcademyData[];
  selectedAcademy: string | null;
  selectedAcademyData: AcademyData | null;
  setSelectedAcademy: (id: string) => void;
  loading: boolean;
  refetchAcademies: () => Promise<void>;
}

const STORAGE_KEY = "langopia:selectedAcademy";

const AcademyContext = createContext<AcademyContextValue | null>(null);

export function AcademyProvider({ children }: { children: ReactNode }) {
  const { accessToken, refreshToken } = useAuth();
  const [academies, setAcademies] = useState<AcademyData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const api = useMemo(
    () => new LangopiaClient({ baseUrl: API_URL, accessToken: accessToken ?? undefined, refreshToken: refreshToken ?? undefined }),
    [accessToken, refreshToken],
  );

  const fetchAcademies = useCallback(async () => {
    try {
      const data = await api.academies.list() as unknown as AcademyData[];
      setAcademies(data);

      // Validate stored selection or fall back to first
      const stored =
        typeof window !== "undefined"
          ? localStorage.getItem(STORAGE_KEY)
          : null;
      const valid = data.find((a) => a.id === stored);
      if (valid) {
        setSelectedId(valid.id);
      } else if (data.length > 0) {
        setSelectedId(data[0].id);
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, data[0].id);
        }
      } else {
        setSelectedId(null);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchAcademies();
  }, [fetchAcademies]);

  const setSelectedAcademy = useCallback((id: string) => {
    setSelectedId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  const refetchAcademies = useCallback(async () => {
    setLoading(true);
    await fetchAcademies();
  }, [fetchAcademies]);

  const selectedAcademyData =
    academies.find((a) => a.id === selectedId) ?? null;

  return (
    <AcademyContext.Provider
      value={{
        academies,
        selectedAcademy: selectedId,
        selectedAcademyData,
        setSelectedAcademy,
        loading,
        refetchAcademies,
      }}
    >
      {children}
    </AcademyContext.Provider>
  );
}

export function useAcademy() {
  const ctx = useContext(AcademyContext);
  if (!ctx) {
    throw new Error("useAcademy must be used within an AcademyProvider");
  }
  return ctx;
}
