"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, RotateCcw, Eye, Check, X } from "lucide-react";
import type { ExerciseData } from "./exercise-renderer";

interface Props {
  exercise: ExerciseData;
  mode: "preview" | "interactive";
}

export function TapToOrder({ exercise, mode }: Props) {
  const words = exercise.options ?? [];
  const [selected, setSelected] = useState<string[]>([]);
  const [remaining, setRemaining] = useState<string[]>([...words]);
  const [submitted, setSubmitted] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  const isCorrect = submitted && selected.join(" ") === exercise.correctAnswer;

  const handleTapWord = (word: string, index: number) => {
    if (submitted || mode !== "interactive") return;
    setSelected([...selected, word]);
    const next = [...remaining];
    next.splice(index, 1);
    setRemaining(next);
  };

  const handleRemoveWord = (index: number) => {
    if (submitted) return;
    const word = selected[index];
    const next = [...selected];
    next.splice(index, 1);
    setSelected(next);
    setRemaining([...remaining, word]);
  };

  const handleSubmit = () => {
    if (selected.length === words.length) setSubmitted(true);
  };

  const handleReset = () => {
    setSelected([]);
    setRemaining([...words]);
    setSubmitted(false);
    setShowAnswer(false);
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
        <ArrowUpDown className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">Tap to Order</span>
      </div>
      {exercise.title && <h4 className="font-semibold text-sm">{exercise.title}</h4>}
      <p className="text-sm text-muted-foreground">{exercise.instruction}</p>

      {/* Built sentence */}
      <div className={`min-h-[40px] rounded-md border-2 border-dashed p-2 flex flex-wrap gap-1.5 ${
        submitted
          ? isCorrect
            ? "border-green-300 bg-green-50 dark:bg-green-950/20"
            : "border-red-300 bg-red-50 dark:bg-red-950/20"
          : "border-muted-foreground/30"
      }`}>
        {selected.length === 0 && (
          <span className="text-xs text-muted-foreground italic">Tap words below to build the sentence...</span>
        )}
        {selected.map((word, i) => (
          <button
            key={i}
            onClick={() => handleRemoveWord(i)}
            disabled={submitted}
            className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
              submitted
                ? isCorrect
                  ? "bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200"
                  : "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200"
                : "bg-primary text-primary-foreground hover:bg-primary/80"
            }`}
          >
            {word}
          </button>
        ))}
        {submitted && (
          isCorrect
            ? <Check className="h-4 w-4 text-green-600 ml-1 self-center" />
            : <X className="h-4 w-4 text-red-600 ml-1 self-center" />
        )}
      </div>

      {/* Available words */}
      {mode === "interactive" && (
        <div className="flex flex-wrap gap-1.5">
          {remaining.map((word, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              onClick={() => handleTapWord(word, i)}
              disabled={submitted}
            >
              {word}
            </Button>
          ))}
        </div>
      )}

      {mode === "interactive" && !submitted && selected.length === words.length && (
        <Button size="sm" onClick={handleSubmit}>Check Answer</Button>
      )}

      {submitted && exercise.explanation && (
        <div className={`rounded-md p-3 text-sm ${
          isCorrect
            ? "bg-green-50 border border-green-200 dark:bg-green-950/20"
            : "bg-amber-50 border border-amber-200 dark:bg-amber-950/20"
        }`}>
          {isCorrect ? "Correct! " : `Correct order: "${exercise.correctAnswer}". `}
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
            Answer: {exercise.correctAnswer}
          </p>
        </div>
      )}
    </div>
  );
}
