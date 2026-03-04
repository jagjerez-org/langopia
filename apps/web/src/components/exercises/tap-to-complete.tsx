"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MousePointerClick, RotateCcw, Eye } from "lucide-react";
import type { ExerciseData } from "./exercise-renderer";

interface Props {
  exercise: ExerciseData;
  mode: "preview" | "interactive";
}

export function TapToComplete({ exercise, mode }: Props) {
  const correctAnswers = (exercise.correctAnswer ?? "").split("|").map((a) => a.trim());
  const blanks = (exercise.content.match(/___/g) || []).length;
  const [selected, setSelected] = useState<string[]>(Array(blanks).fill(""));
  const [currentBlank, setCurrentBlank] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  const handleTap = (option: string) => {
    if (submitted || mode !== "interactive") return;
    const next = [...selected];
    next[currentBlank] = option;
    setSelected(next);
    if (currentBlank < blanks - 1) {
      setCurrentBlank(currentBlank + 1);
    } else {
      setSubmitted(true);
    }
  };

  const handleReset = () => {
    setSelected(Array(blanks).fill(""));
    setCurrentBlank(0);
    setSubmitted(false);
    setShowAnswer(false);
  };

  // Render content with blanks replaced
  const renderContent = () => {
    const parts = exercise.content.split("___");
    return parts.map((part, i) => (
      <span key={i}>
        {part}
        {i < parts.length - 1 && (
          <span
            className={`inline-block min-w-[60px] mx-1 px-2 py-0.5 rounded border-b-2 text-center cursor-pointer ${
              selected[i]
                ? submitted
                  ? selected[i] === correctAnswers[i]
                    ? "bg-green-100 border-green-500 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                    : "bg-red-100 border-red-500 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                  : "bg-primary/10 border-primary"
                : i === currentBlank
                ? "bg-muted border-primary animate-pulse"
                : "bg-muted border-muted-foreground/30"
            }`}
            onClick={() => !submitted && setCurrentBlank(i)}
          >
            {selected[i] || "___"}
          </span>
        )}
      </span>
    ));
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
        <MousePointerClick className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">Tap to Complete</span>
      </div>
      {exercise.title && <h4 className="font-semibold text-sm">{exercise.title}</h4>}
      <p className="text-sm text-muted-foreground">{exercise.instruction}</p>

      <div className="text-sm leading-relaxed">{renderContent()}</div>

      {mode === "interactive" && exercise.options && (
        <div className="flex flex-wrap gap-2">
          {exercise.options.map((opt, i) => (
            <Button
              key={i}
              variant={selected.includes(opt) ? "default" : "outline"}
              size="sm"
              onClick={() => handleTap(opt)}
              disabled={submitted || selected.includes(opt)}
            >
              {opt}
            </Button>
          ))}
        </div>
      )}

      {submitted && exercise.explanation && (
        <div className={`rounded-md p-3 text-sm ${
          selected.every((s, i) => s === correctAnswers[i])
            ? "bg-green-50 border border-green-200 dark:bg-green-950/20"
            : "bg-amber-50 border border-amber-200 dark:bg-amber-950/20"
        }`}>
          {selected.every((s, i) => s === correctAnswers[i])
            ? "Correct! "
            : `Correct answer: ${correctAnswers.join(", ")}. `}
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
            Answer: {correctAnswers.join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}
