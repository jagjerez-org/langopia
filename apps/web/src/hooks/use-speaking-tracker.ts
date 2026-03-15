"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParticipants } from "@livekit/components-react";

export interface SpeakingStats {
  /** Total speaking time in ms per participant identity */
  perParticipant: Map<string, { name: string; timeMs: number; isTeacher: boolean }>;
  /** Teacher speaking percentage (0-100) */
  teacherPct: number;
  /** Student speaking percentage (0-100) */
  studentPct: number;
}

export function useSpeakingTracker(): SpeakingStats {
  const participants = useParticipants();
  const speakingTimeRef = useRef(
    new Map<string, { name: string; timeMs: number; isTeacher: boolean }>(),
  );
  const wasSpeakingRef = useRef(new Map<string, boolean>());
  const lastTickRef = useRef(Date.now());
  const [stats, setStats] = useState<SpeakingStats>({
    perParticipant: new Map(),
    teacherPct: 0,
    studentPct: 0,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      let changed = false;

      for (const p of participants) {
        const identity = p.identity;
        const isTeacher = identity.startsWith("teacher-");
        const name = p.name ?? identity;

        if (!speakingTimeRef.current.has(identity)) {
          speakingTimeRef.current.set(identity, {
            name,
            timeMs: 0,
            isTeacher,
          });
        }

        if (p.isSpeaking) {
          const entry = speakingTimeRef.current.get(identity)!;
          entry.timeMs += delta;
          changed = true;
        }
      }

      if (changed) {
        let teacherMs = 0;
        let studentMs = 0;
        for (const [, entry] of speakingTimeRef.current) {
          if (entry.isTeacher) {
            teacherMs += entry.timeMs;
          } else {
            studentMs += entry.timeMs;
          }
        }
        const total = teacherMs + studentMs;
        setStats({
          perParticipant: new Map(speakingTimeRef.current),
          teacherPct: total > 0 ? Math.round((teacherMs / total) * 100) : 0,
          studentPct: total > 0 ? Math.round((studentMs / total) * 100) : 0,
        });
      }
    }, 500);

    return () => clearInterval(interval);
  }, [participants]);

  return stats;
}
