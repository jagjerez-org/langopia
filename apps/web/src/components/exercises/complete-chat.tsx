"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, RotateCcw, Eye } from "lucide-react";
import type { ExerciseData } from "./exercise-renderer";

interface Props {
  exercise: ExerciseData;
  mode: "preview" | "interactive";
}

export function CompleteChat({ exercise, mode }: Props) {
  const correctAnswers = (exercise.correctAnswer ?? "").split("|").map((a) => a.trim());
  const lines = exercise.content.split("\n").filter((l) => l.trim());
  const blankIndices = lines
    .map((line, i) => (line.includes("___") ? i : -1))
    .filter((i) => i >= 0);

  const [filled, setFilled] = useState<Map<number, string>>(new Map());
  const [submitted, setSubmitted] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const usedOptions = new Set(filled.values());

  const handleSelect = (blankIdx: number, option: string) => {
    if (submitted || mode !== "interactive") return;
    const next = new Map(filled);
    next.set(blankIdx, option);
    setFilled(next);
    if (next.size === blankIndices.length) setSubmitted(true);
  };

  const handleReset = () => {
    setFilled(new Map());
    setSubmitted(false);
    setShowAnswer(false);
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
        <MessageSquare className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">Complete Chat</span>
      </div>
      {exercise.title && <h4 className="font-semibold text-sm">{exercise.title}</h4>}
      <p className="text-sm text-muted-foreground">{exercise.instruction}</p>

      {exercise.audioUrl && (
        <audio controls src={exercise.audioUrl} className="w-full h-8" />
      )}

      <div className="space-y-2">
        {lines.map((line, lineIdx) => {
          const speaker = line.match(/^([A-Z]):\s*/)?.[1] ?? "";
          const isBlank = line.includes("___");
          const blankNumber = blankIndices.indexOf(lineIdx);
          const filledValue = filled.get(blankNumber);
          const isCorrect = submitted && filledValue === correctAnswers[blankNumber];

          return (
            <div
              key={lineIdx}
              className={`flex gap-2 ${speaker === "A" ? "" : "justify-end"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  speaker === "A"
                    ? "bg-muted"
                    : isBlank && submitted
                    ? isCorrect
                      ? "bg-green-100 dark:bg-green-950/30"
                      : "bg-red-100 dark:bg-red-950/30"
                    : "bg-primary/10"
                }`}
              >
                {isBlank ? (
                  <span>
                    {line.replace(/^[A-Z]:\s*/, "").replace("___", "")}
                    <span className={`inline-block min-w-[60px] px-2 py-0.5 mx-1 rounded border-b-2 text-center ${
                      filledValue
                        ? submitted
                          ? isCorrect
                            ? "border-green-500 text-green-700 dark:text-green-400"
                            : "border-red-500 text-red-700 dark:text-red-400"
                          : "border-primary"
                        : "border-muted-foreground/30 text-muted-foreground"
                    }`}>
                      {filledValue || "___"}
                    </span>
                  </span>
                ) : (
                  line.replace(/^[A-Z]:\s*/, "")
                )}
              </div>
            </div>
          );
        })}
      </div>

      {mode === "interactive" && exercise.options && !submitted && (
        <div className="flex flex-wrap gap-2">
          {exercise.options.map((opt, i) => (
            <Button
              key={i}
              variant={usedOptions.has(opt) ? "default" : "outline"}
              size="sm"
              onClick={() => {
                const nextBlank = blankIndices.findIndex((_, bi) => !filled.has(bi));
                if (nextBlank >= 0) handleSelect(nextBlank, opt);
              }}
              disabled={submitted || usedOptions.has(opt)}
            >
              {opt}
            </Button>
          ))}
        </div>
      )}

      {submitted && exercise.explanation && (
        <div className="rounded-md p-3 text-sm bg-amber-50 border border-amber-200 dark:bg-amber-950/20">
          {exercise.explanation}
        </div>
      )}

      {mode === "interactive" && (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="mr-1 h-3 w-3" /> Reset
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowAnswer(!showAnswer)}>
            <Eye className="mr-1 h-3 w-3" /> {showAnswer ? "Hide" : "Show"} Answer
          </Button>
        </div>
      )}

      {showAnswer && (
        <div className="rounded-md border border-green-200 bg-green-50 dark:bg-green-950/20 p-3 text-sm">
          <p className="font-medium text-green-700 dark:text-green-400">
            Answers: {correctAnswers.join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}
