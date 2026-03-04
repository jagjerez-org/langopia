"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Video, Eye, RotateCcw } from "lucide-react";
import type { ExerciseData } from "./exercise-renderer";

interface Props {
  exercise: ExerciseData;
  mode: "preview" | "interactive";
}

export function WatchReflect({ exercise, mode }: Props) {
  const [response, setResponse] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
        <Video className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">Watch & Reflect</span>
      </div>
      {exercise.title && <h4 className="font-semibold text-sm">{exercise.title}</h4>}
      <p className="text-sm text-muted-foreground">{exercise.instruction}</p>

      {exercise.videoUrl ? (
        <video
          controls
          src={exercise.videoUrl}
          className="w-full rounded-md max-h-64"
        />
      ) : (
        <div className="rounded-md bg-muted p-6 flex items-center justify-center text-muted-foreground text-sm">
          <Video className="mr-2 h-5 w-5" />
          No video attached yet
        </div>
      )}

      <div className="rounded-md bg-muted/50 p-3 text-sm">
        {exercise.content}
      </div>

      {mode === "interactive" && (
        <>
          <textarea
            className="w-full min-h-[80px] rounded-md border bg-background p-2 text-sm resize-y"
            placeholder="Write your reflection here..."
            value={response}
            onChange={(e) => setResponse(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAnswer(!showAnswer)}>
              <Eye className="mr-1 h-3 w-3" />
              {showAnswer ? "Hide" : "Show"} Model Answer
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setResponse(""); setShowAnswer(false); }}>
              <RotateCcw className="mr-1 h-3 w-3" /> Reset
            </Button>
          </div>
        </>
      )}

      {showAnswer && exercise.correctAnswer && (
        <div className="rounded-md border border-green-200 bg-green-50 dark:bg-green-950/20 p-3 text-sm">
          <p className="font-medium text-green-700 dark:text-green-400 mb-1">Model Answer</p>
          <p className="whitespace-pre-wrap">{exercise.correctAnswer}</p>
        </div>
      )}
    </div>
  );
}
