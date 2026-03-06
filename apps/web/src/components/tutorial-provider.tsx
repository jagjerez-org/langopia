"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "langopia_tutorials_seen";

const SECTION_IDS = [
  "overview",
  "classes",
  "courses",
  "students",
  "teachers",
  "financings",
  "team",
  "exercises",
  "lessons",
  "learning-paths",
  "media",
] as const;

type SectionId = (typeof SECTION_IDS)[number];

interface TutorialContextValue {
  hasSeen: (sectionId: string) => boolean;
  markSeen: (sectionId: string) => void;
  resetAll: () => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

function loadSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {
    // ignore
  }
  return new Set();
}

function persistSeen(seen: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
  } catch {
    // ignore
  }
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [seen, setSeen] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSeen(loadSeen());
  }, []);

  const hasSeen = useCallback(
    (sectionId: string) => seen.has(sectionId),
    [seen],
  );

  const markSeen = useCallback((sectionId: string) => {
    setSeen((prev) => {
      const next = new Set(prev);
      next.add(sectionId);
      persistSeen(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setSeen(new Set());
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return (
    <TutorialContext.Provider value={{ hasSeen, markSeen, resetAll }}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error("useTutorial must be used within a TutorialProvider");
  }
  return ctx;
}
