"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PenLine, RotateCcw, Eye, Check, X } from "lucide-react";
import type { ExerciseData } from "./exercise-renderer";

interface Props {
  exercise: ExerciseData;
  mode: "preview" | "interactive";
}

export function WriteComplete({ exercise, mode }: Props) {
  const correctAnswers = (exercise.correctAnswer ?? "").split("|").map((a) => a.trim());
  const blanks = (exercise.content.match(/___/g) || []).length;
  const [inputs, setInputs] = useState<string[]>(Array(blanks).fill(""));
  const [submitted, setSubmitted] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  const handleChange = (index: number, value: string) => {
    const next = [...inputs];
    next[index] = value;
    setInputs(next);
  };

  const handleSubmit = () => {
    setSubmitted(true);
  };

  const handleReset = () => {
    setInputs(Array(blanks).fill(""));
    setSubmitted(false);
    setShowAnswer(false);
  };

  // Render content with inline input fields
  const renderContent = () => {
    const parts = exercise.content.split("___");
    let blankIdx = 0;

    return parts.map((part, i) => {
      const idx = blankIdx;
      if (i < parts.length - 1) blankIdx++;

      return (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            mode === "interactive" ? (
              <span className="inline-block mx-1">
                <input
                  type="text"
                  value={inputs[idx]}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  disabled={submitted}
                  className={`w-24 px-1.5 py-0.5 rounded border-b-2 text-sm text-center bg-transparent outline-none ${
                    submitted
                      ? inputs[idx].toLowerCase().trim() === correctAnswers[idx]?.toLowerCase().trim()
                        ? "border-green-500 text-green-700 dark:text-green-400"
                        : "border-red-500 text-red-700 dark:text-red-400"
                      : "border-primary focus:border-primary"
                  }`}
                  placeholder="..."
                />
                {submitted && (
                  inputs[idx].toLowerCase().trim() === correctAnswers[idx]?.toLowerCase().trim()
                    ? <Check className="inline h-3 w-3 text-green-600 ml-0.5" />
                    : <X className="inline h-3 w-3 text-red-600 ml-0.5" />
                )}
              </span>
            ) : (
              <span className="inline-block min-w-[60px] mx-1 px-2 py-0.5 rounded border-b-2 border-muted-foreground/30 text-center text-muted-foreground">
                ___
              </span>
            )
          )}
        </span>
      );
    });
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
        <PenLine className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">Write to Complete</span>
      </div>
      {exercise.title && <h4 className="font-semibold text-sm">{exercise.title}</h4>}
      <p className="text-sm text-muted-foreground">{exercise.instruction}</p>

      <div className="text-sm leading-loose">{renderContent()}</div>

      {mode === "interactive" && !submitted && (
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={inputs.some((v) => !v.trim())}
        >
          Check Answers
        </Button>
      )}

      {submitted && exercise.explanation && (
        <div className={`rounded-md p-3 text-sm ${
          inputs.every((v, i) => v.toLowerCase().trim() === correctAnswers[i]?.toLowerCase().trim())
            ? "bg-green-50 border border-green-200 dark:bg-green-950/20"
            : "bg-amber-50 border border-amber-200 dark:bg-amber-950/20"
        }`}>
          {inputs.every((v, i) => v.toLowerCase().trim() === correctAnswers[i]?.toLowerCase().trim())
            ? "All correct! "
            : `Correct answers: ${correctAnswers.join(", ")}. `}
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
