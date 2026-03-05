"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useJwtClient } from "@/hooks/use-jwt-client";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, ChevronRight } from "lucide-react";
import type { MyClassesList } from "@langopia/api-client";

const statusTabs = [
  { label: "Upcoming", value: "scheduled" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
] as const;

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  cancelled: "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
};

export default function AppClassesPage() {
  const api = useJwtClient();
  const [activeTab, setActiveTab] = useState("scheduled");
  const [data, setData] = useState<MyClassesList | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.me
      .classes({ status: activeTab })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api, activeTab]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">My Classes</h1>

      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/60">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Class list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        </div>
      ) : !data?.data.length ? (
        <div className="glass flex flex-col items-center gap-2 rounded-2xl py-12 text-center">
          <CalendarDays className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm text-muted-foreground">No classes found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.data.map((cls) => (
            <Link
              key={cls.id}
              href={`/app/classes/${cls.id}`}
              className="glass group flex items-center justify-between rounded-xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{cls.title}</p>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] ${statusColors[cls.status] ?? ""}`}
                  >
                    {cls.status}
                  </Badge>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {new Date(cls.scheduledAt).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  &middot; {cls.durationMinutes}min &middot; {cls.academyName}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 dark:text-zinc-600" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
