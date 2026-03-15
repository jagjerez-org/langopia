"use client";

import type { SpeakingStats } from "@/hooks/use-speaking-tracker";

interface SpeakingIndicatorProps {
  stats: SpeakingStats;
}

export function SpeakingIndicator({ stats }: SpeakingIndicatorProps) {
  const total = stats.teacherPct + stats.studentPct;
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-2 text-[11px]">
      {/* Bar */}
      <div className="flex h-1.5 w-20 overflow-hidden rounded-full bg-zinc-700">
        <div
          className="bg-violet-500 transition-all duration-500"
          style={{ width: `${stats.teacherPct}%` }}
        />
        <div
          className="bg-emerald-500 transition-all duration-500"
          style={{ width: `${stats.studentPct}%` }}
        />
      </div>
      {/* Labels */}
      <span className="text-violet-400">{stats.teacherPct}%</span>
      <span className="text-zinc-600">/</span>
      <span className="text-emerald-400">{stats.studentPct}%</span>
    </div>
  );
}
