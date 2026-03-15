"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessagesSquare, RotateCcw, Eye } from "lucide-react";
import type { ExerciseData } from "./exercise-renderer";

interface Props {
  exercise: ExerciseData;
  mode: "preview" | "interactive";
}

interface DialogLine {
  speaker: "A" | "YOU";
  text: string;
  blankIndex?: number;
}

function parseDialogue(content: string): DialogLine[] {
  const lines = content.split("\n").filter((l) => l.trim());
  const result: DialogLine[] = [];
  let blankIdx = 0;

  for (const line of lines) {
    const matchA = line.match(/^A:\s*(.*)/);
    const matchYou = line.match(/^YOU:\s*(.*)/);

    if (matchA) {
      result.push({ speaker: "A", text: matchA[1] });
    } else if (matchYou) {
      result.push({ speaker: "YOU", text: matchYou[1], blankIndex: blankIdx });
      blankIdx++;
    }
  }

  return result;
}

export function GuidedConversation({ exercise, mode }: Props) {
  const dialogLines = parseDialogue(exercise.content);
  const hints = exercise.options ?? [];
  const modelAnswers = (exercise.correctAnswer ?? "").split("|").map((a) => a.trim());
  const totalBlanks = dialogLines.filter((l) => l.speaker === "YOU").length;

  const [inputs, setInputs] = useState<string[]>(Array(totalBlanks).fill(""));
  const [submitted, setSubmitted] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  const handleChange = (index: number, value: string) => {
    const next = [...inputs];
    next[index] = value;
    setInputs(next);
  };

  const handleSubmit = () => setSubmitted(true);

  const handleReset = () => {
    setInputs(Array(totalBlanks).fill(""));
    setSubmitted(false);
    setShowAnswer(false);
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
        <MessagesSquare className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">Guided Conversation</span>
      </div>
      {exercise.title && <h4 className="font-semibold text-sm">{exercise.title}</h4>}
      <p className="text-sm text-muted-foreground">{exercise.instruction}</p>

      <div className="space-y-2">
        {dialogLines.map((line, i) => {
          if (line.speaker === "A") {
            return (
              <div key={i} className="flex gap-2">
                <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-muted">
                  {line.text}
                </div>
              </div>
            );
          }

          const bIdx = line.blankIndex!;
          const hint = hints[bIdx] ?? "";
          const model = modelAnswers[bIdx] ?? "";

          return (
            <div key={i} className="flex flex-col items-end gap-1">
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                submitted
                  ? "bg-primary/10"
                  : "bg-primary/10"
              }`}>
                {mode === "interactive" ? (
                  <input
                    type="text"
                    value={inputs[bIdx]}
                    onChange={(e) => handleChange(bIdx, e.target.value)}
                    disabled={submitted}
                    placeholder="Type your response..."
                    className="w-full min-w-[200px] bg-transparent outline-none text-sm placeholder:text-muted-foreground/50"
                  />
                ) : (
                  <span className="text-muted-foreground">___</span>
                )}
              </div>
              {hint && (
                <span className="text-xs italic text-muted-foreground mr-2">{hint}</span>
              )}
              {submitted && (
                <div className="max-w-[80%] text-xs text-muted-foreground mr-2">
                  <span className="font-medium">Model:</span> {model}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {mode === "interactive" && !submitted && (
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={inputs.some((v) => !v.trim())}
        >
          Check Conversation
        </Button>
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
        <div className="rounded-md border border-green-200 bg-green-50 dark:bg-green-950/20 p-3 text-sm space-y-1">
          <p className="font-medium text-green-700 dark:text-green-400">Model answers:</p>
          {modelAnswers.map((ans, i) => (
            <p key={i} className="text-green-700 dark:text-green-400">
              {i + 1}. {ans}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
