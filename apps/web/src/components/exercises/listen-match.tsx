"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AudioLines, RotateCcw, Eye } from "lucide-react";
import type { ExerciseData } from "./exercise-renderer";

interface Props {
  exercise: ExerciseData;
  mode: "preview" | "interactive";
}

export function ListenMatch({ exercise, mode }: Props) {
  // Parse pairs from content (format: "word1 = def1 | word2 = def2")
  const pairs = exercise.content.split("|").map((p) => {
    const [left, right] = p.split("=").map((s) => s.trim());
    return { left: left ?? "", right: right ?? "" };
  });

  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matches, setMatches] = useState<Map<number, number>>(new Map());
  const [showAnswer, setShowAnswer] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const rightItems = pairs.map((p, i) => ({ text: p.right, originalIndex: i }));

  const handleLeftClick = (i: number) => {
    if (submitted || mode !== "interactive") return;
    setSelectedLeft(i);
  };

  const handleRightClick = (rightIdx: number) => {
    if (submitted || mode !== "interactive" || selectedLeft === null) return;
    const next = new Map(matches);
    next.set(selectedLeft, rightIdx);
    setMatches(next);
    setSelectedLeft(null);
    if (next.size === pairs.length) setSubmitted(true);
  };

  const handleReset = () => {
    setSelectedLeft(null);
    setMatches(new Map());
    setSubmitted(false);
    setShowAnswer(false);
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400">
        <AudioLines className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">Listen & Match</span>
      </div>
      {exercise.title && <h4 className="font-semibold text-sm">{exercise.title}</h4>}
      <p className="text-sm text-muted-foreground">{exercise.instruction}</p>

      {exercise.audioUrl && (
        <audio controls src={exercise.audioUrl} className="w-full h-8" />
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {pairs.map((pair, i) => (
            <button
              key={i}
              onClick={() => handleLeftClick(i)}
              className={`w-full text-left px-3 py-2 rounded-md border text-sm transition-colors ${
                selectedLeft === i
                  ? "border-primary bg-primary/10"
                  : matches.has(i)
                  ? submitted && matches.get(i) === i
                    ? "border-green-300 bg-green-50 dark:bg-green-950/20"
                    : submitted
                    ? "border-red-300 bg-red-50 dark:bg-red-950/20"
                    : "border-blue-300 bg-blue-50 dark:bg-blue-950/20"
                  : "hover:bg-muted/50"
              }`}
            >
              {pair.left}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {rightItems.map((item, i) => {
            const isMatched = Array.from(matches.values()).includes(i);
            return (
              <button
                key={i}
                onClick={() => handleRightClick(i)}
                className={`w-full text-left px-3 py-2 rounded-md border text-sm transition-colors ${
                  isMatched
                    ? "border-blue-300 bg-blue-50 dark:bg-blue-950/20"
                    : selectedLeft !== null
                    ? "hover:border-primary hover:bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                {item.text}
              </button>
            );
          })}
        </div>
      </div>

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
          <p className="font-medium text-green-700 dark:text-green-400 mb-1">Correct Matches:</p>
          {pairs.map((p, i) => (
            <p key={i}>{p.left} → {p.right}</p>
          ))}
        </div>
      )}
    </div>
  );
}
