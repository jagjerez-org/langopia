"use client";

import { BookOpen } from "lucide-react";
import type { ExerciseData } from "./exercise-renderer";

interface Props {
  exercise: ExerciseData;
  mode: "preview" | "interactive";
}

export function Intro({ exercise }: Props) {
  return (
    <div className="rounded-lg border bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-5 space-y-3">
      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
        <BookOpen className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">Introduction</span>
      </div>
      {exercise.title && (
        <h3 className="text-lg font-bold">{exercise.title}</h3>
      )}
      <p className="text-sm text-muted-foreground">{exercise.instruction}</p>

      {exercise.imageUrl && (
        <img
          src={exercise.imageUrl}
          alt={exercise.title ?? "Introduction"}
          className="rounded-md max-h-48 object-cover"
        />
      )}

      <div className="text-sm whitespace-pre-wrap leading-relaxed">
        {exercise.content}
      </div>
    </div>
  );
}
