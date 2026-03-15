"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BookHeart, RotateCcw, Eye, Check, X } from "lucide-react";
import type { ExerciseData } from "./exercise-renderer";

interface Props {
  exercise: ExerciseData;
  mode: "preview" | "interactive";
}

type Segment =
  | { type: "narrative"; text: string; blanks: number[] }
  | { type: "choice"; index: number; options: { letter: string; text: string }[] };

function parseStory(content: string): { segments: Segment[]; totalBlanks: number } {
  const segments: Segment[] = [];
  let totalBlanks = 0;

  // Split by [CHOICE:n] blocks
  const parts = content.split(/(\[CHOICE:\d+\][\s\S]*?(?=\n\n|\[CHOICE:|\z|$))/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const choiceMatch = trimmed.match(/^\[CHOICE:(\d+)\]/);
    if (choiceMatch) {
      const choiceIndex = parseInt(choiceMatch[1], 10);
      const lines = trimmed.replace(/^\[CHOICE:\d+\]\s*/, "").split("\n").filter((l) => l.trim());
      const options: { letter: string; text: string }[] = [];
      for (const line of lines) {
        const m = line.match(/^([a-c])\)\s*(.*)/);
        if (m) options.push({ letter: m[1], text: m[2].trim() });
      }
      segments.push({ type: "choice", index: choiceIndex, options });
    } else {
      const blanks: number[] = [];
      let idx = 0;
      let search = trimmed;
      while (search.includes("___")) {
        blanks.push(totalBlanks + idx);
        search = search.replace("___", "");
        idx++;
      }
      totalBlanks += idx;
      segments.push({ type: "narrative", text: trimmed, blanks });
    }
  }

  return { segments, totalBlanks };
}

export function GuidedStory({ exercise, mode }: Props) {
  const { segments, totalBlanks } = parseStory(exercise.content);
  const blankWords = (exercise.options ?? []);
  const correctParts = (exercise.correctAnswer ?? "").split("|").map((a) => a.trim());

  // Map correctAnswer parts to blanks vs choices
  // correctAnswer format: word1|a|word2|b (blanks and choices intercalated)
  const [blankInputs, setBlankInputs] = useState<string[]>(Array(totalBlanks).fill(""));
  const [choiceSelections, setChoiceSelections] = useState<Map<number, string>>(new Map());
  const [submitted, setSubmitted] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  // Build expected answers map: for each element in order of appearance
  // We need to figure out which correctAnswer parts correspond to blanks vs choices
  const expectedAnswers: { type: "blank" | "choice"; value: string }[] = [];
  let bIdx = 0;
  let caIdx = 0;
  for (const seg of segments) {
    if (seg.type === "narrative") {
      for (let i = 0; i < seg.blanks.length; i++) {
        expectedAnswers.push({ type: "blank", value: correctParts[caIdx] ?? "" });
        caIdx++;
      }
    } else {
      expectedAnswers.push({ type: "choice", value: correctParts[caIdx] ?? "" });
      caIdx++;
    }
  }

  // Compute blank answer index mapping
  const blankAnswerIndices: number[] = [];
  let choiceAnswerMap = new Map<number, string>();
  let eIdx = 0;
  let blankCounter = 0;
  for (const seg of segments) {
    if (seg.type === "narrative") {
      for (let i = 0; i < seg.blanks.length; i++) {
        blankAnswerIndices[blankCounter] = eIdx;
        blankCounter++;
        eIdx++;
      }
    } else {
      choiceAnswerMap.set(seg.index, correctParts[eIdx] ?? "");
      eIdx++;
    }
  }

  const getBlankCorrect = (idx: number) => correctParts[blankAnswerIndices[idx]] ?? "";
  const getChoiceCorrect = (choiceIdx: number) => choiceAnswerMap.get(choiceIdx) ?? "";

  const handleBlankChange = (idx: number, value: string) => {
    const next = [...blankInputs];
    next[idx] = value;
    setBlankInputs(next);
  };

  const handleChoiceSelect = (choiceIdx: number, letter: string) => {
    if (submitted || mode !== "interactive") return;
    const next = new Map(choiceSelections);
    next.set(choiceIdx, letter);
    setChoiceSelections(next);
  };

  const handleSubmit = () => setSubmitted(true);

  const handleReset = () => {
    setBlankInputs(Array(totalBlanks).fill(""));
    setChoiceSelections(new Map());
    setSubmitted(false);
    setShowAnswer(false);
  };

  const totalChoices = segments.filter((s) => s.type === "choice").length;
  const allFilled = blankInputs.every((v) => v.trim()) && choiceSelections.size >= totalChoices;

  let globalBlankIdx = 0;

  const renderNarrative = (text: string, blanks: number[]) => {
    if (blanks.length === 0) return <p className="text-sm leading-relaxed">{text}</p>;

    const parts = text.split("___");
    let localIdx = 0;

    return (
      <p className="text-sm leading-loose">
        {parts.map((part, i) => {
          const bI = globalBlankIdx;
          if (i < parts.length - 1) {
            globalBlankIdx++;
            localIdx++;
          }
          const correct = getBlankCorrect(bI);
          const isCorrect = submitted && blankInputs[bI]?.toLowerCase().trim() === correct.toLowerCase().trim();

          return (
            <span key={i}>
              {part}
              {i < parts.length - 1 && (
                mode === "interactive" ? (
                  <span className="inline-block mx-1">
                    <input
                      type="text"
                      value={blankInputs[bI]}
                      onChange={(e) => handleBlankChange(bI, e.target.value)}
                      disabled={submitted}
                      className={`w-24 px-1.5 py-0.5 rounded border-b-2 text-sm text-center bg-transparent outline-none ${
                        submitted
                          ? isCorrect
                            ? "border-green-500 text-green-700 dark:text-green-400"
                            : "border-red-500 text-red-700 dark:text-red-400"
                          : "border-primary focus:border-primary"
                      }`}
                      placeholder="..."
                    />
                    {submitted && (
                      isCorrect
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
        })}
      </p>
    );
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
        <BookHeart className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">Guided Story</span>
      </div>
      {exercise.title && <h4 className="font-semibold text-sm">{exercise.title}</h4>}
      <p className="text-sm text-muted-foreground">{exercise.instruction}</p>

      <div className="space-y-3">
        {segments.map((seg, sIdx) => {
          if (seg.type === "narrative") {
            return <div key={sIdx}>{renderNarrative(seg.text, seg.blanks)}</div>;
          }

          const selected = choiceSelections.get(seg.index);
          const correctLetter = getChoiceCorrect(seg.index);

          return (
            <div key={sIdx} className="space-y-1 pl-4 border-l-2 border-primary/30">
              <p className="text-xs font-medium text-muted-foreground uppercase">Choose your path</p>
              {seg.options.map((opt) => {
                const isSelected = selected === opt.letter;
                const isRight = submitted && opt.letter === correctLetter;

                return (
                  <button
                    key={opt.letter}
                    onClick={() => handleChoiceSelect(seg.index, opt.letter)}
                    disabled={submitted || mode !== "interactive"}
                    className={`w-full text-left text-sm rounded-md px-3 py-2 border transition-colors ${
                      submitted
                        ? isRight
                          ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                          : isSelected
                          ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                          : "border-transparent"
                        : isSelected
                        ? "border-primary bg-primary/10"
                        : "border-transparent hover:bg-muted"
                    }`}
                  >
                    <span className="font-medium">{opt.letter})</span> {opt.text}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {mode === "interactive" && !submitted && (
        <Button size="sm" onClick={handleSubmit} disabled={!allFilled}>
          Check Story
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
        <div className="rounded-md border border-green-200 bg-green-50 dark:bg-green-950/20 p-3 text-sm">
          <p className="font-medium text-green-700 dark:text-green-400">
            Blanks: {blankWords.join(", ")}
          </p>
          <p className="text-green-700 dark:text-green-400">
            Full answers: {correctParts.join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}
