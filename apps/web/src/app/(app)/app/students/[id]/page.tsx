"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useJwtClient } from "@/hooks/use-jwt-client";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  FileText,
  ChevronRight,
} from "lucide-react";
import type { MyStudentDetail } from "@langopia/api-client";

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  cancelled: "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
};

export default function AppStudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const api = useJwtClient();
  const [student, setStudent] = useState<MyStudentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me
      .studentDetail(id)
      .then(setStudent)
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

  if (!student) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Link href="/app/students" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-zinc-900 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <p className="text-center text-muted-foreground">Student not found</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link href="/app/students" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-zinc-900 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to students
      </Link>

      {/* Student info card */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{student.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {student.email} &middot; {student.academyName}
            </p>
          </div>
          <div className="flex gap-1.5">
            {student.cefrEstimate && (
              <Badge variant="secondary">{student.cefrEstimate}</Badge>
            )}
            {!student.isActive && (
              <Badge variant="outline" className="text-zinc-400">
                Inactive
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Total Classes</p>
              <p className="text-sm font-medium">{student.totalClasses}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Total Minutes</p>
              <p className="text-sm font-medium">{student.totalMinutes}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Class history */}
      <div className="glass rounded-2xl p-5">
        <h2 className="mb-3 font-semibold">
          Class History ({student.classes.length})
        </h2>
        {student.classes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No classes yet
          </p>
        ) : (
          <div className="space-y-2">
            {student.classes.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] ${statusColors[c.status] ?? ""}`}
                    >
                      {c.status}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(c.scheduledAt).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    &middot; {c.durationMinutes}min &middot; {c.classType}
                  </p>
                </div>
                {c.reportId ? (
                  <Link
                    href={`/app/reports/${c.reportId}?student=${student.id}`}
                    className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Report
                  </Link>
                ) : (
                  <ChevronRight className="h-4 w-4 text-zinc-300 dark:text-zinc-600" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
