"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { useJwtClient } from "@/hooks/use-jwt-client";
import {
  CalendarDays,
  CheckCircle2,
  Users,
  FileText,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import type { MyStats } from "@langopia/api-client";

export default function AppHomePage() {
  const { user } = useAuth();
  const api = useJwtClient();
  const [stats, setStats] = useState<MyStats | null>(null);

  useEffect(() => {
    api.me.stats().then(setStats).catch(() => {});
  }, [api]);

  const cards = [
    {
      label: "Upcoming Classes",
      value: stats?.upcomingClasses ?? 0,
      icon: CalendarDays,
      color: "from-violet-500 to-purple-600",
    },
    {
      label: "Completed",
      value: stats?.completedClasses ?? 0,
      icon: CheckCircle2,
      color: "from-emerald-500 to-green-600",
    },
    {
      label: "Reports",
      value: stats?.totalReports ?? 0,
      icon: FileText,
      color: "from-blue-500 to-cyan-600",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Hi,{" "}
          <span className="text-gradient">
            {user?.name?.split(" ")[0] ?? "there"}
          </span>
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Here&apos;s what&apos;s happening with your classes
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="glass rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div
                className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${card.color} text-white shadow-sm`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Next class card */}
      {stats?.nextClass && (
        <Link
          href={`/app/classes/${stats.nextClass.id}`}
          className="glass group flex items-center justify-between rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">{stats.nextClass.title}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(stats.nextClass.scheduledAt).toLocaleDateString(
                  "en-US",
                  {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )}{" "}
                &middot; {stats.nextClass.durationMinutes}min
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-zinc-400 transition-transform group-hover:translate-x-1" />
        </Link>
      )}

      {/* Quick links */}
      <div className="flex gap-3">
        <Link
          href="/app/classes"
          className="glass flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <CalendarDays className="h-4 w-4" />
          Classes
        </Link>
        <Link
          href="/app/students"
          className="glass flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <Users className="h-4 w-4" />
          Students
        </Link>
        <Link
          href="/app/reports"
          className="glass flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <FileText className="h-4 w-4" />
          Reports
        </Link>
      </div>
    </div>
  );
}
