"use client";

import { useEffect, useState } from "react";
import { FileText, ChevronRight } from "lucide-react";
import { useAcademy } from "@/components/academy-provider";
import { useApiKeyClient } from "@/hooks/use-api-client";

interface ReportSummary {
  roomId: string;
  roomTitle: string;
  status: string;
  summary: string | null;
  classDuration: number;
  studentCount: number;
  createdAt: string;
}

export default function ReportsPage() {
  const { selectedAcademy, selectedAcademyData, loading } = useAcademy();
  const api = useApiKeyClient();
  const [reports, setReports] = useState<ReportSummary[]>([]);

  useEffect(() => {
    setReports([]);
    if (!selectedAcademy || !selectedAcademyData?.apiKey) return;

    api.rooms.list({ status: "completed", limit: 50 })
      .then(async (result) => {
        const rooms = result.data ?? [];
        const reportPromises = rooms.map(async (room) => {
          try {
            const report = await api.rooms.getReport(room.id) as unknown as {
              status: string;
              summary: string | null;
              classDuration?: number;
              students?: unknown[];
              createdAt: string;
            };
            return {
              roomId: room.id,
              roomTitle: room.title,
              status: report.status,
              summary: report.summary,
              classDuration: report.classDuration ?? 0,
              studentCount: report.students?.length ?? 0,
              createdAt: report.createdAt,
            };
          } catch {
            return null;
          }
        });

        const results = (await Promise.all(reportPromises)).filter(Boolean);
        setReports(results as ReportSummary[]);
      })
      .catch(() => {});
  }, [selectedAcademy, selectedAcademyData, api]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-8 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass h-24 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!selectedAcademy) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="glass flex flex-col items-center justify-center rounded-xl py-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-zinc-400" />
          <p className="font-medium text-zinc-500">No academy selected</p>
          <p className="mt-1 text-sm text-zinc-400">Select an academy from the sidebar to view reports</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-zinc-500">AI-generated class reports</p>
        </div>
      </div>

      <div className="space-y-3">
        {reports.map((report) => (
          <div key={report.roomId} className="glass rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 text-white">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold">{report.roomTitle}</h3>
                  <p className="text-xs text-zinc-500">
                    {Math.round(report.classDuration / 60)} min &middot;{" "}
                    {report.studentCount} students &middot;{" "}
                    {new Date(report.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                  report.status === "completed"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : report.status === "processing"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                }`}
              >
                {report.status}
              </span>
            </div>
            {report.summary && (
              <p className="mt-3 line-clamp-2 text-sm text-zinc-500">
                {report.summary}
              </p>
            )}
          </div>
        ))}

        {reports.length === 0 && (
          <div className="glass flex flex-col items-center justify-center rounded-xl py-16 text-center">
            <FileText className="mb-3 h-10 w-10 text-zinc-400" />
            <p className="font-medium text-zinc-500">No reports yet</p>
            <p className="mt-1 text-sm text-zinc-400">
              Reports are generated automatically after classes end
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
