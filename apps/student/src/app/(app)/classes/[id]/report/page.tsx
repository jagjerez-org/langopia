"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getApiClient } from "@/lib/api";
import { ChevronLeft } from "lucide-react";
import type { StudentClassReport } from "@langopia/api-client";

export default function ClassReportPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<StudentClassReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getApiClient()
      .studentApp.classReport(id)
      .then(setReport)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-3 py-6">
      <Link href={`/classes/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Back
      </Link>

      <h1 className="mb-4 text-xl font-bold">Class Report</h1>

      {report ? (
        <div className="space-y-4">
          {report.summary && (
            <div className="rounded-xl bg-card p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Summary</h3>
              <p className="text-sm">{report.summary}</p>
            </div>
          )}

          {report.studentReport && (
            <div className="rounded-xl bg-card p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Your Report</h3>
              <pre className="text-xs text-muted-foreground overflow-auto">
                {JSON.stringify(report.studentReport, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-muted/50 p-8 text-center">
          <p className="text-sm text-muted-foreground">Report not available yet</p>
        </div>
      )}
    </div>
  );
}
