"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { LangopiaClient } from "@langopia/api-client";

interface UseEndOfClassSuggestionsOptions {
  roomId: string;
  role: "teacher" | "student";
  scheduledAt: string | null;
  durationMinutes: number | null;
  api: LangopiaClient;
}

export interface ContentSuggestion {
  type: "topic" | "vocabulary" | "grammar";
  title: string;
  description: string;
  keywords: string[];
}

export function useEndOfClassSuggestions({
  roomId,
  role,
  scheduledAt,
  durationMinutes,
  api,
}: UseEndOfClassSuggestionsOptions) {
  const [suggestions, setSuggestions] = useState<ContentSuggestion[] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const triggeredRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const triggerAndPoll = useCallback(async () => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    setLoading(true);

    try {
      await api.roomInternal.triggerSuggestions(roomId);
    } catch {
      // May already be triggered
    }

    // Poll for results
    pollRef.current = setInterval(async () => {
      try {
        const result = await api.roomInternal.getSuggestions(roomId);
        if (result.status === "completed" && result.suggestions) {
          setSuggestions(result.suggestions as unknown as ContentSuggestion[]);
          setLoading(false);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // Keep polling
      }
    }, 3000);
  }, [roomId, api]);

  useEffect(() => {
    // Only trigger for teachers with valid schedule
    if (role !== "teacher" || !scheduledAt || !durationMinutes) return;

    const endTime = new Date(scheduledAt).getTime() + durationMinutes * 60000;
    const triggerTime = endTime - 5 * 60000; // 5 min before end
    const now = Date.now();
    const delay = triggerTime - now;

    if (delay <= 0) {
      // Already past trigger time, trigger immediately
      triggerAndPoll();
      return;
    }

    const timeout = setTimeout(triggerAndPoll, delay);
    return () => {
      clearTimeout(timeout);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [role, scheduledAt, durationMinutes, triggerAndPoll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return { suggestions, loading };
}
