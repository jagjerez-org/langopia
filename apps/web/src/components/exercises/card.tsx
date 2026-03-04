"use client";

import { useState } from "react";
import { CreditCard, ChevronDown, ChevronUp } from "lucide-react";
import type { ExerciseData } from "./exercise-renderer";

interface Props {
  exercise: ExerciseData;
  mode: "preview" | "interactive";
}

export function Card({ exercise, mode }: Props) {
  const [expanded, setExpanded] = useState(mode === "preview");

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        className="w-full p-4 text-left flex items-center justify-between hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-purple-100 dark:bg-purple-900/30 p-1.5">
            <CreditCard className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">{exercise.title ?? "Concept Card"}</h4>
            <p className="text-xs text-muted-foreground">{exercise.instruction}</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t">
          {exercise.imageUrl && (
            <img
              src={exercise.imageUrl}
              alt={exercise.title ?? "Concept"}
              className="rounded-md max-h-40 object-cover mt-3"
            />
          )}
          <div className="text-sm whitespace-pre-wrap leading-relaxed pt-3">
            {exercise.content}
          </div>
          {exercise.audioUrl && (
            <audio controls src={exercise.audioUrl} className="w-full h-8" />
          )}
        </div>
      )}
    </div>
  );
}
