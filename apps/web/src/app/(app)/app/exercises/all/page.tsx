"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useJwtClient } from "@/hooks/use-jwt-client";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronRight, Dumbbell } from "lucide-react";
import type { MyExercisesList } from "@langopia/api-client";

const cefrTabs = ["All", "A1", "A2", "B1", "B2", "C1", "C2"] as const;

const cefrColors: Record<string, string> = {
  A1: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
  A2: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  B1: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  B2: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  C1: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
  C2: "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300",
};

const typeLabels: Record<string, string> = {
  warm_up: "Warm Up",
  intro: "Introduction",
  card: "Concept Card",
  tap_to_complete: "Tap to Complete",
  tap_to_order: "Tap to Order",
  listen_match: "Listen & Match",
  listen_repeat: "Listen & Repeat",
  watch_reflect: "Watch & Reflect",
  complete_chat: "Complete Chat",
  write_complete: "Write to Complete",
  listen_complete: "Listen & Complete",
};

export default function AllExercisesPage() {
  const api = useJwtClient();
  const [activeTab, setActiveTab] = useState<(typeof cefrTabs)[number]>("All");
  const [data, setData] = useState<MyExercisesList | null>(null);
  const [loading, setLoading] = useState(true);

  const params = useMemo(
    () => (activeTab === "All" ? undefined : { cefrLevel: activeTab }),
    [activeTab],
  );

  const load = useCallback(() => {
    setLoading(true);
    api.me
      .exercises(params)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api, params]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <Link
        href="/app/exercises"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Exercises
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">All Exercises</h1>

      {/* CEFR tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/60">
        {cefrTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Exercise list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        </div>
      ) : !data?.data.length ? (
        <div className="glass flex flex-col items-center gap-2 rounded-2xl py-12 text-center">
          <Dumbbell className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm text-muted-foreground">No exercises found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.data.map((exercise) => (
            <Link
              key={exercise.id}
              href={`/app/exercises/${exercise.id}`}
              className="glass group flex items-center justify-between rounded-xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">
                    {exercise.title ?? typeLabels[exercise.type] ?? exercise.type}
                  </p>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] ${cefrColors[exercise.cefrLevel] ?? ""}`}
                  >
                    {exercise.cefrLevel}
                  </Badge>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {typeLabels[exercise.type] ?? exercise.type}
                  </span>
                  {exercise.targetSkill && (
                    <>
                      <span className="text-xs text-zinc-300 dark:text-zinc-600">
                        &middot;
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {exercise.targetSkill}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 dark:text-zinc-600" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
