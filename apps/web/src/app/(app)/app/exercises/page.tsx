"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useJwtClient } from "@/hooks/use-jwt-client";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  ChevronRight,
  Grid3X3,
  Dumbbell,
} from "lucide-react";
import type { MyLessonsList } from "@langopia/api-client";

const cefrTabs = ["All", "A1", "A2", "B1", "B2", "C1", "C2"] as const;

const cefrColors: Record<string, string> = {
  A1: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
  A2: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  B1: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  B2: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  C1: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
  C2: "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300",
};

export default function AppExercisesPage() {
  const api = useJwtClient();
  const [activeTab, setActiveTab] = useState<(typeof cefrTabs)[number]>("All");
  const [data, setData] = useState<MyLessonsList | null>(null);
  const [loading, setLoading] = useState(true);

  const params = useMemo(
    () => (activeTab === "All" ? undefined : { cefrLevel: activeTab }),
    [activeTab],
  );

  const load = useCallback(() => {
    setLoading(true);
    api.me
      .lessons(params)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api, params]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Exercises</h1>

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

      {/* Browse all exercises link */}
      <Link
        href="/app/exercises/all"
        className="glass group flex items-center justify-between rounded-xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm">
            <Grid3X3 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Browse All Exercises</p>
            <p className="text-sm text-muted-foreground">
              View exercises across all lessons
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-zinc-300 transition-transform group-hover:translate-x-0.5 dark:text-zinc-600" />
      </Link>

      {/* Lesson list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        </div>
      ) : !data?.data.length ? (
        <div className="glass flex flex-col items-center gap-2 rounded-2xl py-12 text-center">
          <BookOpen className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm text-muted-foreground">No lessons found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.data.map((lesson) => (
            <Link
              key={lesson.id}
              href={`/app/exercises/lessons/${lesson.id}`}
              className="glass group flex items-center justify-between rounded-xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{lesson.title}</p>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] ${cefrColors[lesson.cefrLevel] ?? ""}`}
                  >
                    {lesson.cefrLevel}
                  </Badge>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {lesson.exerciseCount} exercise
                  {lesson.exerciseCount !== 1 ? "s" : ""} &middot;{" "}
                  {lesson.language}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-500/20">
                  <Dumbbell className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                </div>
                <span className="text-sm font-medium text-violet-600 dark:text-violet-400">
                  {lesson.exerciseCount}
                </span>
                <ChevronRight className="h-5 w-5 text-zinc-300 transition-transform group-hover:translate-x-0.5 dark:text-zinc-600" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
