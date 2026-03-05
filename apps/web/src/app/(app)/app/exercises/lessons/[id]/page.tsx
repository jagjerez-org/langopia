"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useJwtClient } from "@/hooks/use-jwt-client";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Play,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import type { MyLessonDetail } from "@langopia/api-client";

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

export default function LessonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const api = useJwtClient();
  const [lesson, setLesson] = useState<MyLessonDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me
      .lessonDetail(id)
      .then(setLesson)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api, id]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="space-y-4">
        <Link
          href="/app/exercises"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Exercises
        </Link>
        <div className="glass flex flex-col items-center gap-2 rounded-2xl py-12 text-center">
          <BookOpen className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm text-muted-foreground">Lesson not found</p>
        </div>
      </div>
    );
  }

  const exerciseIds = lesson.exercises.map((e) => e.id);

  return (
    <div className="space-y-5">
      {/* Back link */}
      <Link
        href="/app/exercises"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Exercises
      </Link>

      {/* Lesson header */}
      <div className="glass rounded-2xl p-5">
        <h1 className="text-xl font-bold">{lesson.title}</h1>
        {lesson.description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {lesson.description}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge
            variant="secondary"
            className={cefrColors[lesson.cefrLevel] ?? ""}
          >
            {lesson.cefrLevel}
          </Badge>
          <Badge variant="secondary">{lesson.language}</Badge>
          <Badge variant="secondary">
            {lesson.exercises.length} exercise
            {lesson.exercises.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      {/* Practice All */}
      {lesson.exercises.length > 0 && (
        <Link
          href={`/app/exercises/${exerciseIds[0]}?ids=${exerciseIds.join(",")}&index=0`}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-3 font-semibold text-white shadow-sm transition-all hover:shadow-md"
        >
          <Play className="h-4 w-4" />
          Practice All
        </Link>
      )}

      {/* Exercise list */}
      <div className="space-y-2">
        {lesson.exercises.map((exercise, index) => (
          <Link
            key={exercise.id}
            href={`/app/exercises/${exercise.id}?ids=${exerciseIds.join(",")}&index=${index}`}
            className="glass group flex items-center justify-between rounded-xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-sm font-semibold text-zinc-500 dark:bg-zinc-800">
                {index + 1}
              </div>
              <div>
                <p className="font-medium">{exercise.title ?? typeLabels[exercise.type] ?? exercise.type}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {typeLabels[exercise.type] ?? exercise.type}
                  </span>
                  {exercise.targetSkill && (
                    <>
                      <span className="text-xs text-zinc-300 dark:text-zinc-600">&middot;</span>
                      <span className="text-xs text-muted-foreground">
                        {exercise.targetSkill}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-zinc-300 transition-transform group-hover:translate-x-0.5 dark:text-zinc-600" />
          </Link>
        ))}
      </div>
    </div>
  );
}
