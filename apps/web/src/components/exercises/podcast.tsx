"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Podcast as PodcastIcon, RotateCcw, Eye, ChevronDown, ChevronUp } from "lucide-react";
import type { ExerciseData } from "./exercise-renderer";

interface Props {
  exercise: ExerciseData;
  mode: "preview" | "interactive";
}

interface ParsedQuestion {
  text: string;
  options: { letter: string; text: string }[];
}

function parseContent(content: string) {
  const [transcriptRaw, questionsRaw] = content.split("---QUESTIONS---");
  const transcript = (transcriptRaw ?? "").trim();
  const questions: ParsedQuestion[] = [];

  if (questionsRaw) {
    const qBlocks = questionsRaw.trim().split(/(?=\d+\.\s)/);
    for (const block of qBlocks) {
      const lines = block.trim().split("\n").filter((l) => l.trim());
      if (lines.length === 0) continue;
      const questionText = lines[0].replace(/^\d+\.\s*/, "").trim();
      const options: { letter: string; text: string }[] = [];
      for (let i = 1; i < lines.length; i++) {
        const match = lines[i].match(/^([a-c])\)\s*(.*)/);
        if (match) options.push({ letter: match[1], text: match[2].trim() });
      }
      if (questionText) questions.push({ text: questionText, options });
    }
  }

  return { transcript, questions };
}

function formatTranscript(transcript: string) {
  return transcript.split("\n").filter((l) => l.trim()).map((line, i) => {
    const match = line.match(/^(HOST|GUEST):\s*(.*)/);
    if (match) {
      return (
        <p key={i} className="text-sm">
          <span className="font-semibold text-primary">{match[1]}:</span> {match[2]}
        </p>
      );
    }
    return <p key={i} className="text-sm">{line}</p>;
  });
}

export function Podcast({ exercise, mode }: Props) {
  const { transcript, questions } = parseContent(exercise.content);
  const correctAnswers = (exercise.correctAnswer ?? "").split("|").map((a) => a.trim());
  const explanations = (exercise.explanation ?? "").split("|").map((e) => e.trim());

  const [answers, setAnswers] = useState<Map<number, string>>(new Map());
  const [submitted, setSubmitted] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showTranscript, setShowTranscript] = useState(mode === "preview");

  const handleSelect = (qIdx: number, letter: string) => {
    if (submitted || mode !== "interactive") return;
    const next = new Map(answers);
    next.set(qIdx, letter);
    setAnswers(next);
  };

  const handleSubmit = () => setSubmitted(true);

  const handleReset = () => {
    setAnswers(new Map());
    setSubmitted(false);
    setShowAnswer(false);
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
        <PodcastIcon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">Podcast</span>
      </div>
      {exercise.title && <h4 className="font-semibold text-sm">{exercise.title}</h4>}
      <p className="text-sm text-muted-foreground">{exercise.instruction}</p>

      {exercise.audioUrl && (
        <audio controls src={exercise.audioUrl} className="w-full h-8" />
      )}

      {mode === "interactive" ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTranscript(!showTranscript)}
          className="text-xs"
        >
          {showTranscript ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
          {showTranscript ? "Hide" : "Show"} Transcript
        </Button>
      ) : null}

      {showTranscript && (
        <div className="rounded-md bg-muted/50 p-3 space-y-1">
          {formatTranscript(transcript)}
        </div>
      )}

      {questions.length > 0 && (
        <div className="space-y-4">
          {questions.map((q, qIdx) => {
            const selected = answers.get(qIdx);
            const isCorrect = submitted && selected === correctAnswers[qIdx];

            return (
              <div key={qIdx} className="space-y-2">
                <p className="text-sm font-medium">
                  {qIdx + 1}. {q.text}
                </p>
                <div className="space-y-1">
                  {q.options.map((opt) => {
                    const isSelected = selected === opt.letter;
                    const isRight = submitted && opt.letter === correctAnswers[qIdx];

                    return (
                      <button
                        key={opt.letter}
                        onClick={() => handleSelect(qIdx, opt.letter)}
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
                {submitted && explanations[qIdx] && (
                  <p className={`text-xs px-3 ${isCorrect ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {explanations[qIdx]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {mode === "interactive" && !submitted && questions.length > 0 && (
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={answers.size < questions.length}
        >
          Check Answers
        </Button>
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
