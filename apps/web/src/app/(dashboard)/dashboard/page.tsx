"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { School, Video, FileText, Clock, Zap, Sparkles } from "lucide-react";
import type { DashboardOverview } from "@langopia/api-client";
import { useApiClient } from "@/hooks/use-api-client";

export default function DashboardOverviewPage() {
  const { user } = useAuth();
  const api = useApiClient();
  const [stats, setStats] = useState<DashboardOverview | null>(null);

  useEffect(() => {
    api.dashboard.overview().then(setStats).catch(() => {});
  }, [api]);

  const cards = [
    { label: "Academies", value: stats?.totalAcademies ?? 0, icon: School, color: "from-violet-500 to-purple-600" },
    { label: "Rooms", value: stats?.totalRooms ?? 0, icon: Video, color: "from-blue-500 to-cyan-600" },
    { label: "Reports", value: stats?.totalReports ?? 0, icon: FileText, color: "from-emerald-500 to-green-600" },
    { label: "Class Hours", value: stats?.totalClassHours ?? 0, icon: Clock, color: "from-amber-500 to-orange-600" },
    { label: "AI Tokens", value: stats?.totalTokens ?? 0, icon: Zap, color: "from-pink-500 to-rose-600" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back,{" "}
            <span className="text-gradient">{user?.name?.split(" ")[0] ?? "there"}</span>
          </h1>
          <p className="mt-1.5 text-zinc-500 dark:text-zinc-400">
            Here&apos;s an overview of your Langopia account
          </p>
        </div>
        <div className="glass hidden items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-zinc-500 md:flex dark:text-zinc-400">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="glass rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <div className="mb-3 flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${card.color} text-white shadow-sm`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="text-2xl font-bold">{card.value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
