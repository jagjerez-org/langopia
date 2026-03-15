"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useJwtClient } from "@/hooks/use-jwt-client";
import { Badge } from "@/components/ui/badge";
import { FileText, ChevronRight, Users } from "lucide-react";
import type { MyReportsList } from "@langopia/api-client";

export default function AppReportsPage() {
  const api = useJwtClient();
  const [data, setData] = useState<MyReportsList | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me
      .reports()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">My Reports</h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        </div>
      ) : !data?.data.length ? (
        <div className="glass flex flex-col items-center gap-2 rounded-2xl py-12 text-center">
          <FileText className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm text-muted-foreground">No reports yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.data.map((report) => (
            <Link
              key={report.id}
              href={`/app/reports/${report.id}`}
              className="glass group flex items-center justify-between rounded-xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">
                    {report.class?.title ?? "Untitled"}
                  </p>
                  <Badge variant="secondary" className="text-[10px]">
                    {report.status}
                  </Badge>
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-sm text-muted-foreground">
                  {report.class && (
                    <span>
                      {new Date(report.class.scheduledAt).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric" },
                      )}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {report.studentCount}
                  </span>
                  {report.classDuration > 0 && (
                    <span>{report.classDuration}min</span>
                  )}
                </div>
                {report.summary && (
                  <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
                    {report.summary}
                  </p>
                )}
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 dark:text-zinc-600" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
