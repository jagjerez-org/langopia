"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  GraduationCap,
  Calendar,
  Clock,
  Users,
  Loader2,
  CheckCircle,
  XCircle,
  Globe,
  FileText,
  TrendingUp,
  UserX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useApiKeyClient } from "@/hooks/use-api-client";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { TeacherDetailResponse } from "@langopia/api-client";

const CEFR_COLORS: Record<string, string> = {
  A1: "#22c55e",
  A2: "#84cc16",
  B1: "#eab308",
  B2: "#f97316",
  C1: "#ef4444",
  C2: "#8b5cf6",
  Unknown: "#a1a1aa",
};

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(d: string | null | undefined) {
  if (!d) return "Never";
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

export default function TeacherDetailPage() {
  const params = useParams<{ id: string }>();
  const api = useApiKeyClient();

  const [teacher, setTeacher] = useState<TeacherDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchTeacher = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await api.teachers.get(params.id);
      setTeacher(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [api, params.id]);

  useEffect(() => {
    fetchTeacher();
  }, [fetchTeacher]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        </div>
      </div>
    );
  }

  if (error || !teacher) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Link
          href="/dashboard/teachers"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Teachers
        </Link>
        <div className="glass-subtle flex flex-col items-center justify-center rounded-xl border border-zinc-200/40 py-16 text-center dark:border-zinc-700/40">
          <GraduationCap className="mb-3 h-10 w-10 text-zinc-400" />
          <p className="font-medium text-zinc-500">Teacher not found</p>
        </div>
      </div>
    );
  }

  const totalHours = Math.round(teacher.totalMinutes / 60);
  const memberSinceDays = Math.floor(
    (Date.now() - new Date(teacher.createdAt).getTime()) / 86400000,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Link
          href="/dashboard/teachers"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Teachers
        </Link>

        <div className="glass-subtle flex items-center gap-4 rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-xl font-bold text-white">
            {teacher.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {teacher.name}
              </h1>
              <Badge variant="secondary" className={teacher.isActive ? "" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}>
                {teacher.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              {teacher.email}
            </p>
          </div>
          <div className="hidden text-right text-xs text-zinc-400 sm:block">
            <p>Member since {formatDate(teacher.createdAt)}</p>
            <p className="mt-0.5">{memberSinceDays} days in the academy</p>
          </div>
        </div>
      </div>

      {/* KPI Cards — 2 rows */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Total Classes", value: teacher.totalClasses, icon: Calendar, color: "text-violet-500 bg-violet-100 dark:bg-violet-900/30" },
          { label: "Total Hours", value: `${totalHours}h`, icon: Clock, color: "text-amber-500 bg-amber-100 dark:bg-amber-900/30" },
          { label: "Unique Students", value: teacher.uniqueStudents, icon: Users, color: "text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30" },
          { label: "Completed", value: teacher.completedClasses, icon: CheckCircle, color: "text-green-500 bg-green-100 dark:bg-green-900/30" },
          { label: "Cancel Rate", value: `${teacher.cancelRate}%`, icon: XCircle, color: "text-red-500 bg-red-100 dark:bg-red-900/30" },
          { label: "Avg Duration", value: `${teacher.avgDuration}m`, icon: TrendingUp, color: "text-blue-500 bg-blue-100 dark:bg-blue-900/30" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="glass-subtle rounded-xl border border-zinc-200/40 p-4 dark:border-zinc-700/40"
          >
            <div className="flex items-center gap-2.5">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${kpi.color}`}>
                <kpi.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold">{kpi.value}</p>
                <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">{kpi.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick info row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Languages */}
        <div className="glass-subtle rounded-xl border border-zinc-200/40 p-5 dark:border-zinc-700/40">
          <div className="mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-semibold">Languages Taught</h2>
          </div>
          {teacher.languagesTaught.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {teacher.languagesTaught.map((lang) => (
                <span
                  key={lang}
                  className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium capitalize text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                >
                  {lang}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">No classes yet</p>
          )}
        </div>

        {/* Quick stats */}
        <div className="glass-subtle rounded-xl border border-zinc-200/40 p-5 dark:border-zinc-700/40">
          <div className="mb-3 flex items-center gap-2">
            <UserX className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-semibold">Student No-Show Rate</h2>
          </div>
          <p className="text-3xl font-bold">{teacher.noShowRate}%</p>
          <p className="mt-1 text-xs text-zinc-500">of enrolled students didn&apos;t attend</p>
        </div>

        {/* AI reports + last class */}
        <div className="glass-subtle rounded-xl border border-zinc-200/40 p-5 dark:border-zinc-700/40">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-semibold">AI Reports</h2>
          </div>
          <p className="text-3xl font-bold">{teacher.aiReportsCount}</p>
          <p className="mt-1 text-xs text-zinc-500">
            Last class: {timeAgo(teacher.lastClassAt)}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Weekly Activity */}
        <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
          <h2 className="mb-4 text-sm font-semibold">Weekly Activity (Last 8 Weeks)</h2>
          <div className="h-52">
            {teacher.weeklyActivity.some((w) => w.classes > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={teacher.weeklyActivity}>
                  <defs>
                    <linearGradient id="colorTeacherClasses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(161,161,170,0.2)" />
                  <XAxis dataKey="week" tick={{ fontSize: 12, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#a1a1aa" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(24,24,27,0.9)",
                      border: "1px solid rgba(63,63,70,0.4)",
                      borderRadius: "8px",
                      color: "#fafafa",
                      fontSize: "13px",
                    }}
                  />
                  <Area type="monotone" dataKey="classes" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorTeacherClasses)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                No activity in the last 8 weeks
              </div>
            )}
          </div>
        </div>

        {/* Teaching Hours */}
        <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
          <h2 className="mb-4 text-sm font-semibold">Teaching Hours (Last 6 Months)</h2>
          <div className="h-52">
            {teacher.monthlyHours.some((m) => m.hours > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teacher.monthlyHours}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(113,113,122,0.2)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="rgba(113,113,122,0.5)" />
                  <YAxis tick={{ fontSize: 12 }} stroke="rgba(113,113,122,0.5)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(24,24,27,0.9)",
                      border: "1px solid rgba(113,113,122,0.3)",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                No teaching hours in the last 6 months
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Student Distribution */}
      {teacher.studentLevelDistribution.length > 0 && (
        <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
          <h2 className="mb-4 text-sm font-semibold">Students by CEFR Level</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={teacher.studentLevelDistribution}
                  dataKey="count"
                  nameKey="level"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={3}
                  label={({ name, value }: { name?: string; value?: number }) =>
                    `${name ?? ""}: ${value ?? 0}`
                  }
                >
                  {teacher.studentLevelDistribution.map((entry) => (
                    <Cell key={entry.level} fill={CEFR_COLORS[entry.level] ?? "#a1a1aa"} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(24,24,27,0.9)",
                    border: "1px solid rgba(113,113,122,0.3)",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent Classes Table */}
      <div className="glass-subtle overflow-hidden rounded-xl border border-zinc-200/40 dark:border-zinc-700/40">
        <div className="p-5 pb-0">
          <h2 className="mb-3 text-sm font-semibold">
            Recent Classes
            <span className="ml-2 text-xs font-normal text-zinc-400">
              ({teacher.recentClasses.length})
            </span>
          </h2>
        </div>
        {teacher.recentClasses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200/40 text-left text-xs text-zinc-500 dark:border-zinc-700/40">
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium">Title</th>
                  <th className="px-5 py-2.5 font-medium">Student(s)</th>
                  <th className="px-5 py-2.5 font-medium">Type</th>
                  <th className="px-5 py-2.5 font-medium">Lang</th>
                  <th className="px-5 py-2.5 font-medium">Duration</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {teacher.recentClasses.map((cls) => (
                  <tr
                    key={cls.classId}
                    className="border-b border-zinc-100/40 last:border-0 hover:bg-zinc-50/50 dark:border-zinc-800/40 dark:hover:bg-zinc-800/30"
                  >
                    <td className="whitespace-nowrap px-5 py-2.5 text-zinc-600 dark:text-zinc-400">
                      {new Date(cls.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td className="px-5 py-2.5 font-medium">{cls.title}</td>
                    <td className="max-w-[200px] truncate px-5 py-2.5">{cls.students || "—"}</td>
                    <td className="px-5 py-2.5 capitalize text-zinc-500">{cls.classType}</td>
                    <td className="px-5 py-2.5 capitalize text-zinc-500">{cls.language}</td>
                    <td className="px-5 py-2.5 text-zinc-600 dark:text-zinc-400">{cls.durationMinutes}m</td>
                    <td className="px-5 py-2.5">
                      <Badge variant="secondary" className="capitalize">
                        {cls.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center py-10 text-sm text-zinc-400">
            No classes yet
          </div>
        )}
      </div>
    </div>
  );
}
