"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getApiClient } from "@/lib/api";
import { X, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentLessonRunner } from "@langopia/api-client";

export default function LessonRunnerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<StudentLessonRunner | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastResult, setLastResult] = useState<{ xp: number; isCorrect: boolean | null } | null>(null);

  useEffect(() => {
    getApiClient()
      .studentApp.lessonRunner(id)
      .then((d) => {
        setData(d);
        setCurrentIndex(d.progress.lastExerciseIndex);
      })
      .catch(() => router.back())
      .finally(() => setLoading(false));
  }, [id, router]);

  const submitAnswer = useCallback(async (answer?: string, isCorrect?: boolean) => {
    if (!data || submitting) return;
    const exercise = data.exercises[currentIndex];
    if (!exercise) return;

    setSubmitting(true);
    try {
      const result = await getApiClient().studentApp.submitExercise(exercise.id, {
        answer,
        isCorrect,
        timeSpentSeconds: 30, // simplified
        lessonId: data.lessonId,
      });
      setLastResult(result);
      setShowFeedback(true);
    } catch {
      // Continue anyway
      setShowFeedback(true);
    } finally {
      setSubmitting(false);
    }
  }, [data, currentIndex, submitting]);

  const nextExercise = useCallback(async () => {
    if (!data) return;
    setShowFeedback(false);
    setLastResult(null);

    if (currentIndex + 1 >= data.exercises.length) {
      // Lesson complete
      try {
        await getApiClient().studentApp.completeLesson(data.lessonId);
      } catch {}
      router.push("/study");
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  }, [data, currentIndex, router]);

  if (loading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const exercise = data.exercises[currentIndex];
  const progress = data.exercises.length > 0
    ? ((currentIndex + (showFeedback ? 1 : 0)) / data.exercises.length) * 100
    : 0;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1}/{data.exercises.length}
          </span>
        </div>
      </div>

      {/* Exercise content */}
      <div className="flex flex-1 flex-col px-4 pb-24 pt-6">
        {exercise && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {exercise.type.replace(/_/g, " ")}
            </div>
            <h2 className="mb-6 text-lg font-bold">{exercise.title}</h2>

            {/* Simplified exercise renderer — renders content as JSON for now */}
            {(() => {
              const c = exercise.content as Record<string, unknown>;
              return (
            <div className="rounded-xl bg-muted/50 p-4">
              {c.text ? (
                <p className="text-sm">{String(c.text)}</p>
              ) : null}
              {c.question ? (
                <p className="mt-2 font-medium">{String(c.question)}</p>
              ) : null}
              {Array.isArray(c.options) && (
                <div className="mt-4 space-y-2">
                  {(c.options as { text: string; isCorrect?: boolean }[]).map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => submitAnswer(opt.text, opt.isCorrect)}
                      disabled={showFeedback || submitting}
                      className={cn(
                        "w-full rounded-lg border-2 p-3 text-left text-sm transition-colors",
                        showFeedback && opt.isCorrect
                          ? "border-green-500 bg-green-50"
                          : "border-border hover:border-primary/50",
                      )}
                    >
                      {opt.text}
                    </button>
                  ))}
                </div>
              )}

              {/* Fallback: simple "Continue" for non-interactive exercises */}
              {!Array.isArray(c.options) && (
                <button
                  onClick={() => submitAnswer(undefined, true)}
                  disabled={showFeedback || submitting}
                  className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  Got it
                </button>
              )}
            </div>
              );
            })()}
          </div>
        )}

        {/* Feedback overlay */}
        {showFeedback && (
          <div className="mt-6 rounded-xl bg-green-50 p-4 text-center">
            <Check className="mx-auto mb-2 h-8 w-8 text-green-600" />
            <p className="font-medium text-green-700">
              {lastResult?.isCorrect === false ? "Not quite!" : "Great job!"}
            </p>
            {lastResult?.xp && (
              <p className="text-sm text-green-600">+{lastResult.xp} XP</p>
            )}
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      {showFeedback && (
        <div className="safe-bottom fixed inset-x-0 bottom-0 bg-background/80 px-4 pb-4 pt-2 backdrop-blur-sm">
          <button
            onClick={nextExercise}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground"
          >
            {currentIndex + 1 >= data.exercises.length ? "Finish lesson" : "Continue"}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
