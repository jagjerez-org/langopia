"use client";

import { useEffect, useState, useMemo, useCallback, type ReactNode } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useJwtClient } from "@/hooks/use-jwt-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from "lucide-react";
import type { ExerciseResponse } from "@langopia/api-client";

const typeLabels: Record<string, string> = {
  warm_up: "Warm Up",
  intro: "Introduction",
  card: "Concept Card",
  tap_to_complete: "Tap to Complete",
  tap_to_order: "Tap to Order",
  listen_match: "Listen & Match",
  listen_repeat: "Listen & Repeat",
  watch_reflect: "Watch & Reflect",
  complete_chat: "Complete Chat",
  write_complete: "Write to Complete",
  listen_complete: "Listen & Complete",
};

export default function ExercisePracticePage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const api = useJwtClient();
  const [exercise, setExercise] = useState<ExerciseResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const ids = useMemo(
    () => searchParams.get("ids")?.split(",") ?? [],
    [searchParams],
  );
  const currentIndex = parseInt(searchParams.get("index") ?? "0", 10);
  const hasNext = currentIndex < ids.length - 1;
  const hasPrev = currentIndex > 0;

  useEffect(() => {
    setLoading(true);
    api.me
      .exerciseDetail(id)
      .then(setExercise)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api, id]);

  const goNext = useCallback(() => {
    if (!hasNext) return;
    const nextIndex = currentIndex + 1;
    const nextId = ids[nextIndex];
    router.push(
      `/app/exercises/${nextId}?ids=${ids.join(",")}&index=${nextIndex}`,
    );
  }, [hasNext, currentIndex, ids, router]);

  const goPrev = useCallback(() => {
    if (!hasPrev) return;
    const prevIndex = currentIndex - 1;
    const prevId = ids[prevIndex];
    router.push(
      `/app/exercises/${prevId}?ids=${ids.join(",")}&index=${prevIndex}`,
    );
  }, [hasPrev, currentIndex, ids, router]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="space-y-4">
        <Link
          href="/app/exercises"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Exercises
        </Link>
        <div className="glass flex flex-col items-center gap-2 rounded-2xl py-12 text-center">
          <p className="text-sm text-muted-foreground">Exercise not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Back + progress */}
      <div className="flex items-center justify-between">
        <Link
          href="/app/exercises"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        {ids.length > 1 && (
          <span className="text-sm font-medium text-muted-foreground">
            {currentIndex + 1} / {ids.length}
          </span>
        )}
      </div>

      {/* Exercise header */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
          {typeLabels[exercise.type] ?? exercise.type}
        </Badge>
        <Badge variant="secondary">{exercise.cefrLevel}</Badge>
        {exercise.title && (
          <span className="text-sm font-medium text-muted-foreground">
            {exercise.title}
          </span>
        )}
      </div>

      {/* Exercise body */}
      <ExerciseRenderer exercise={exercise} />

      {/* Navigation */}
      {ids.length > 1 && (
        <div className="flex gap-3">
          {hasPrev && (
            <Button variant="outline" className="flex-1" onClick={goPrev}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
          )}
          {hasNext && (
            <Button className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600 text-white" onClick={goNext}>
              Next Exercise
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Exercise renderer ─────────────────────────────── */

function ExerciseRenderer({ exercise }: { exercise: ExerciseResponse }) {
  switch (exercise.type) {
    case "tap_to_complete":
      return <TapToComplete exercise={exercise} />;
    case "write_complete":
    case "listen_complete":
      return <WriteComplete exercise={exercise} />;
    case "complete_chat":
      return <CompleteChat exercise={exercise} />;
    default:
      return <PreviewExercise exercise={exercise} />;
  }
}

/* ─── Preview (non-interactive) ─────────────────────── */

function PreviewExercise({ exercise }: { exercise: ExerciseResponse }) {
  return (
    <div className="space-y-4">
      <Section label="Instruction">
        <p>{exercise.instruction}</p>
      </Section>
      <Section label="Content">
        <div className="glass rounded-xl p-4">
          <p className="whitespace-pre-wrap leading-relaxed">{exercise.content}</p>
        </div>
      </Section>
      {exercise.options && exercise.options.length > 0 && (
        <Section label="Options">
          <div className="flex flex-wrap gap-2">
            {exercise.options.map((opt, i) => (
              <span
                key={i}
                className="rounded-lg bg-violet-50 px-3 py-1.5 text-sm text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"
              >
                {opt}
              </span>
            ))}
          </div>
        </Section>
      )}
      {exercise.correctAnswer && (
        <Section label="Correct Answer">
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            {exercise.correctAnswer}
          </div>
        </Section>
      )}
      {exercise.explanation && (
        <Section label="Explanation">
          <p className="text-sm text-muted-foreground">{exercise.explanation}</p>
        </Section>
      )}
    </div>
  );
}

/* ─── Tap to Complete ───────────────────────────────── */

function TapToComplete({ exercise }: { exercise: ExerciseResponse }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const isCorrect = selected === exercise.correctAnswer;
  const options = exercise.options ?? [];
  const parts = exercise.content.split(/_{3,}|\{\{blank\}\}/);

  const reset = () => {
    setSelected(null);
    setChecked(false);
  };

  return (
    <div className="space-y-4">
      <Section label="Instruction">
        <p>{exercise.instruction}</p>
      </Section>

      <div className="glass rounded-xl p-4">
        <p className="text-base leading-relaxed">
          {parts.map((part, i) => (
            <span key={i}>
              {part}
              {i < parts.length - 1 && (
                <span
                  className={`mx-1 inline-block min-w-[60px] rounded-lg border-b-2 px-2 py-0.5 text-center font-semibold ${
                    checked
                      ? isCorrect
                        ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10"
                        : "border-red-400 bg-red-50 text-red-700 dark:bg-red-500/10"
                      : "border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-500/10"
                  }`}
                >
                  {selected ?? "___"}
                </span>
              )}
            </span>
          ))}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isSelected = selected === opt;
          const showCorrect = checked && opt === exercise.correctAnswer;
          const showWrong = checked && isSelected && !isCorrect;

          return (
            <button
              key={opt}
              onClick={() => !checked && setSelected(opt)}
              disabled={checked}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                showCorrect
                  ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-400 dark:bg-emerald-500/20 dark:text-emerald-300"
                  : showWrong
                    ? "bg-red-100 text-red-700 ring-2 ring-red-400 dark:bg-red-500/20 dark:text-red-300"
                    : isSelected
                      ? "bg-violet-100 text-violet-700 ring-2 ring-violet-400 dark:bg-violet-500/20 dark:text-violet-300"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      <FeedbackActions
        checked={checked}
        isCorrect={isCorrect}
        correctAnswer={exercise.correctAnswer}
        explanation={exercise.explanation}
        canCheck={!!selected}
        onCheck={() => setChecked(true)}
        onReset={reset}
      />
    </div>
  );
}

/* ─── Write to Complete ─────────────────────────────── */

function WriteComplete({ exercise }: { exercise: ExerciseResponse }) {
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const correctAnswer = exercise.correctAnswer ?? "";
  const isCorrect =
    answer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
  const parts = exercise.content.split(/_{3,}|\{\{blank\}\}/);

  const reset = () => {
    setAnswer("");
    setChecked(false);
  };

  return (
    <div className="space-y-4">
      <Section label="Instruction">
        <p>{exercise.instruction}</p>
      </Section>

      <div className="glass rounded-xl p-4">
        <p className="text-base leading-relaxed">
          {parts.map((part, i) => (
            <span key={i}>
              {part}
              {i < parts.length - 1 && (
                <span
                  className={`mx-1 inline-block min-w-[60px] rounded-lg border-b-2 px-2 py-0.5 text-center font-semibold ${
                    checked
                      ? isCorrect
                        ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10"
                        : "border-red-400 bg-red-50 text-red-700 dark:bg-red-500/10"
                      : "border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-500/10"
                  }`}
                >
                  {answer.trim() || "___"}
                </span>
              )}
            </span>
          ))}
        </p>
      </div>

      <Input
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        disabled={checked}
        placeholder="Type your answer..."
        className={`rounded-xl ${
          checked
            ? isCorrect
              ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-500/10"
              : "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-500/10"
            : ""
        }`}
      />

      <FeedbackActions
        checked={checked}
        isCorrect={isCorrect}
        correctAnswer={exercise.correctAnswer}
        explanation={exercise.explanation}
        canCheck={!!answer.trim()}
        onCheck={() => setChecked(true)}
        onReset={reset}
      />
    </div>
  );
}

/* ─── Complete Chat ──────────────────────────────────── */

function CompleteChat({ exercise }: { exercise: ExerciseResponse }) {
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const correctAnswer = exercise.correctAnswer ?? "";
  const isCorrect =
    answer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();

  const lines = exercise.content
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      const text = match ? match[2] : line;
      return {
        speaker: match?.[1]?.trim() ?? "",
        text,
        hasBlank: /_{3,}|\{\{blank\}\}/.test(text),
      };
    });

  const reset = () => {
    setAnswer("");
    setChecked(false);
  };

  return (
    <div className="space-y-4">
      <Section label="Instruction">
        <p>{exercise.instruction}</p>
      </Section>

      <div className="space-y-2">
        {lines.map((line, i) => {
          const isEven = i % 2 === 0;
          const displayText = line.hasBlank
            ? line.text.replace(
                /_{3,}|\{\{blank\}\}/,
                answer.trim() || "_____",
              )
            : line.text;

          return (
            <div
              key={i}
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                isEven
                  ? "mr-auto bg-zinc-100 dark:bg-zinc-800"
                  : "ml-auto bg-violet-100 dark:bg-violet-500/20"
              }`}
            >
              {line.speaker && (
                <p className="mb-0.5 text-[10px] font-semibold text-muted-foreground">
                  {line.speaker}
                </p>
              )}
              <p
                className={`text-sm ${
                  line.hasBlank && checked
                    ? isCorrect
                      ? "font-semibold text-emerald-700 dark:text-emerald-300"
                      : "font-semibold text-red-700 dark:text-red-300"
                    : ""
                }`}
              >
                {displayText}
              </p>
            </div>
          );
        })}
      </div>

      <Input
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        disabled={checked}
        placeholder="Type the missing word(s)..."
        className={`rounded-xl ${
          checked
            ? isCorrect
              ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-500/10"
              : "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-500/10"
            : ""
        }`}
      />

      <FeedbackActions
        checked={checked}
        isCorrect={isCorrect}
        correctAnswer={exercise.correctAnswer}
        explanation={exercise.explanation}
        canCheck={!!answer.trim()}
        onCheck={() => setChecked(true)}
        onReset={reset}
      />
    </div>
  );
}

/* ─── Shared components ──────────────────────────────── */

function Section({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function FeedbackActions({
  checked,
  isCorrect,
  correctAnswer,
  explanation,
  canCheck,
  onCheck,
  onReset,
}: {
  checked: boolean;
  isCorrect: boolean;
  correctAnswer: string | null;
  explanation: string | null;
  canCheck: boolean;
  onCheck: () => void;
  onReset: () => void;
}) {
  if (!checked) {
    return (
      <Button
        onClick={onCheck}
        disabled={!canCheck}
        className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white disabled:opacity-40"
      >
        Check Answer
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className={`flex items-center gap-2 rounded-xl p-4 ${
          isCorrect
            ? "bg-emerald-50 dark:bg-emerald-500/10"
            : "bg-red-50 dark:bg-red-500/10"
        }`}
      >
        {isCorrect ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <XCircle className="h-5 w-5 shrink-0 text-red-600" />
        )}
        <p
          className={`text-sm font-medium ${
            isCorrect
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-red-700 dark:text-red-300"
          }`}
        >
          {isCorrect
            ? "Correct!"
            : `Incorrect. Answer: ${correctAnswer}`}
        </p>
      </div>

      {explanation && (
        <div className="glass rounded-xl p-3">
          <p className="text-sm text-muted-foreground">{explanation}</p>
        </div>
      )}

      <Button
        variant="outline"
        onClick={onReset}
        className="w-full rounded-xl"
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        Try Again
      </Button>
    </div>
  );
}
