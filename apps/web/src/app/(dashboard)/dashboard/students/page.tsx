"use client";

import { useEffect, useState } from "react";
import { Users, Search } from "lucide-react";
import { useAcademy } from "@/components/academy-provider";
import { useApiKeyClient } from "@/hooks/use-api-client";

interface Student {
  id: string;
  email: string;
  name: string;
  totalRooms: number;
  totalMinutes: number;
  cefrEstimate: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export default function StudentsPage() {
  const { selectedAcademy, selectedAcademyData, loading } = useAcademy();
  const api = useApiKeyClient();
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setStudents([]);
    setTotal(0);
    if (!selectedAcademy || !selectedAcademyData?.apiKey) return;

    api.students
      .list({ search: search || undefined, limit: 50 })
      .then((data) => {
        setStudents((data.data ?? []) as unknown as Student[]);
        setTotal(data.total ?? 0);
      })
      .catch(() => {
        /* ignore */
      });
  }, [selectedAcademy, selectedAcademyData, search, api]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-8 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="glass h-64 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!selectedAcademy) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="glass flex flex-col items-center justify-center rounded-xl py-16 text-center">
          <Users className="mb-3 h-10 w-10 text-zinc-400" />
          <p className="font-medium text-zinc-500">No academy selected</p>
          <p className="mt-1 text-sm text-zinc-400">Select an academy from the sidebar to view students</p>
        </div>
      </div>
    );
  }

  const cefrColors: Record<string, string> = {
    A1: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    A2: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    B1: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    B2: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    C1: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    C2: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Students</h1>
          <p className="text-sm text-zinc-500">{total} students tracked</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search students..."
              className="rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
        </div>
      </div>

      <div className="glass overflow-hidden rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200/40 dark:border-zinc-700/40">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Student
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                CEFR
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Classes
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Hours
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Last Seen
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {students.map((student) => (
              <tr key={student.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                <td className="px-4 py-3">
                  <p className="font-medium">{student.name}</p>
                  <p className="text-xs text-zinc-500">{student.email}</p>
                </td>
                <td className="px-4 py-3">
                  {student.cefrEstimate ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        cefrColors[student.cefrEstimate] ?? cefrColors.B1
                      }`}
                    >
                      {student.cefrEstimate}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-400">--</span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {student.totalRooms}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {Math.round(student.totalMinutes / 60 * 10) / 10}h
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {new Date(student.lastSeenAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {students.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="mb-3 h-10 w-10 text-zinc-400" />
            <p className="font-medium text-zinc-500">No students yet</p>
            <p className="mt-1 text-sm text-zinc-400">
              Students appear when they join rooms
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
