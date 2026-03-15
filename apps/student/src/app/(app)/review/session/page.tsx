"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getApiClient } from "@/lib/api";
import { X, Eye, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReviewItemResponse } from "@langopia/api-client";

const QUALITY_OPTIONS = [
  { value: 0, label: "Again", color: "text-red-600 border-red-300 bg-red-50" },
  { value: 3, label: "Hard", color: "text-orange-600 border-orange-300 bg-orange-50" },
  { value: 4, label: "Good", color: "text-blue-600 border-blue-300 bg-blue-50" },
  { value: 5, label: "Easy", color: "text-green-600 border-green-300 bg-green-50" },
];

export default function ReviewSessionPage() {
  const router = useRouter();
  const [items, setItems] = useState<ReviewItemResponse[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(0);

  useEffect(() => {
    getApiClient()
      .studentApp.reviewQueue()
      .then(setItems)
      .catch(() => router.back())
      .finally(() => setLoading(false));
  }, [router]);

  const submitQuality = useCallback(async (quality: number) => {
    const item = items[currentIndex];
    if (!item || submitting) return;

    setSubmitting(true);
    try {
      await getApiClient().studentApp.submitReview(item.id, { quality });
    } catch {}
    setSubmitting(false);
    setCompleted((c) => c + 1);
    setRevealed(false);

    if (currentIndex + 1 >= items.length) {
      // Session done
      router.push("/review");
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  }, [items, currentIndex, submitting, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <p className="text-lg font-medium">No items to review</p>
          <button onClick={() => router.back()} className="mt-2 text-sm text-primary">
            Go back
          </button>
        </div>
      </div>
    );
  }

  const item = items[currentIndex];
  const content = item.content as Record<string, string>;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${items.length > 0 ? (completed / items.length) * 100 : 0}%` }}
              />
            </div>
          </div>
          <span className="text-xs text-muted-foreground">
            {completed}/{items.length}
          </span>
        </div>
      </div>

      {/* Card */}
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {/* Front */}
          <div className="rounded-2xl bg-card p-8 text-center shadow-md">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {item.itemType}
            </div>
            <div className="text-xl font-bold">
              {content.word || content.text || content.correction || "Review item"}
            </div>
            {content.context && (
              <p className="mt-2 text-sm text-muted-foreground italic">{content.context}</p>
            )}
          </div>

          {/* Reveal / Answer */}
          {!revealed ? (
            <button
              onClick={() => setRevealed(true)}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 font-semibold text-primary-foreground"
            >
              <Eye className="h-4 w-4" />
              Show Answer
            </button>
          ) : (
            <div className="mt-6 animate-in fade-in duration-300">
              {/* Answer */}
              <div className="mb-4 rounded-xl bg-muted/50 p-4 text-center">
                <div className="text-lg font-medium">
                  {content.translation || content.correction || content.rule || "—"}
                </div>
              </div>

              {/* Quality buttons */}
              <div className="grid grid-cols-4 gap-2">
                {QUALITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => submitQuality(opt.value)}
                    disabled={submitting}
                    className={cn(
                      "rounded-lg border-2 py-3 text-sm font-medium transition-colors",
                      opt.color,
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
