"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, BookOpen, Target, TrendingUp } from "lucide-react";
import { useApiKeyClient } from "@/hooks/use-api-client";

interface KpiData {
  classCount: number;
  studentCount: number;
  completionRate: number;
  averageScore: number;
}

interface LessonKpisProps {
  lessonId: string;
}

export function LessonKpis({ lessonId }: LessonKpisProps) {
  const api = useApiKeyClient();
  const [kpis, setKpis] = useState<KpiData | null>(null);

  const loadKpis = useCallback(async () => {
    try {
      const data = await api.lessons.getKpis(lessonId);
      setKpis(data as unknown as KpiData);
    } catch {
      // ignore — KPIs are optional
    }
  }, [api, lessonId]);

  useEffect(() => {
    loadKpis();
  }, [loadKpis]);

  if (!kpis) return null;

  const cards = [
    {
      label: "Classes Used",
      value: kpis.classCount,
      icon: BookOpen,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-100 dark:bg-violet-900/30",
    },
    {
      label: "Students",
      value: kpis.studentCount,
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      label: "Completion",
      value: `${kpis.completionRate}%`,
      icon: Target,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
    },
    {
      label: "Avg Score",
      value: `${kpis.averageScore}%`,
      icon: TrendingUp,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-900/30",
    },
  ];

  // Don't show if all zeros
  if (kpis.classCount === 0 && kpis.studentCount === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="glass flex items-center gap-3 rounded-xl p-4">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.bg}`}>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </div>
          <div>
            <p className="text-lg font-bold">{card.value}</p>
            <p className="text-xs text-zinc-500">{card.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
