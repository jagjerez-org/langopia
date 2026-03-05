"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useJwtClient } from "@/hooks/use-jwt-client";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Clock,
  Mic,
  BookOpen,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import type { MyReportDetail } from "@langopia/api-client";

export default function AppReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const api = useJwtClient();
  const [report, setReport] = useState<MyReportDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me
      .reportDetail(id)
      .then(setReport)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api, id]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-4">
        <Link href="/app/reports" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-zinc-900 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <p className="text-center text-muted-foreground">Report not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link href="/app/reports" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-zinc-900 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to reports
      </Link>

      {/* Header */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{report.class.title}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {report.academyName} &middot;{" "}
              {new Date(report.class.scheduledAt).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
          <Badge variant="secondary">{report.status}</Badge>
        </div>

        {report.summary && (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            {report.summary}
          </p>
        )}

        <div className="mt-4 flex gap-4 text-sm">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {report.classDuration}min
          </span>
          {report.teacher && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Mic className="h-3.5 w-3.5" />
              Teacher spoke {Math.round(report.teacher.speakingRatio * 100)}%
            </span>
          )}
        </div>
      </div>

      {/* Student breakdowns */}
      {report.studentReports.map((sr) => (
        <div key={sr.studentId} className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{sr.name}</p>
              <p className="text-xs text-muted-foreground">{sr.email}</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>
                Spoke {Math.round(sr.speakingRatio * 100)}% &middot;{" "}
                {sr.fillerWords} fillers
              </p>
            </div>
          </div>

          {/* Vocabulary */}
          {sr.vocabulary.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground">
                <BookOpen className="h-3 w-3" /> Vocabulary (
                {sr.vocabulary.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sr.vocabulary.map((v, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-violet-50 px-2 py-0.5 text-xs text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"
                  >
                    {v.word}{" "}
                    <span className="text-[10px] opacity-70">
                      {v.cefrLevel}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Grammar errors */}
          {sr.grammarErrors.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground">
                <AlertTriangle className="h-3 w-3" /> Grammar (
                {sr.grammarErrors.length})
              </p>
              <div className="space-y-1.5">
                {sr.grammarErrors.map((g, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-red-50 p-2.5 text-xs dark:bg-red-500/10"
                  >
                    <p>
                      <span className="line-through text-red-600 dark:text-red-400">
                        {g.text}
                      </span>{" "}
                      &rarr;{" "}
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        {g.correction}
                      </span>
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      {g.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Homework suggestions */}
          {sr.homeworkSuggestions.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground">
                <Lightbulb className="h-3 w-3" /> Homework Suggestions
              </p>
              <ul className="list-inside list-disc space-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                {sr.homeworkSuggestions.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
