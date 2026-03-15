"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Calendar,
  Clock,
  BookOpen,
  Mic,
  CreditCard,
  GraduationCap,
  FileText,
  LogIn,
  Flame,
  Zap,
  Target,
  Globe,
  Heart,
  Briefcase,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useApiKeyClient } from "@/hooks/use-api-client";
import { Badge } from "@/components/ui/badge";
import type { StudentDetailResponse } from "@langopia/api-client";

const LANGUAGE_FLAGS: Record<string, string> = {
  english: "🇬🇧", spanish: "🇪🇸", french: "🇫🇷", german: "🇩🇪",
  italian: "🇮🇹", portuguese: "🇧🇷", japanese: "🇯🇵", chinese: "🇨🇳", korean: "🇰🇷",
};

function getLanguageDisplay(code: string | null | undefined) {
  if (!code) return "—";
  const flag = LANGUAGE_FLAGS[code.toLowerCase()] || "🌍";
  return `${flag} ${code.charAt(0).toUpperCase() + code.slice(1)}`;
}

const cefrColors: Record<string, string> = {
  A1: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  A2: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  B1: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  B2: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  C1: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  C2: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
};

const classStatusBadge: Record<string, { label: string; className: string }> = {
  attended: {
    label: "Attended",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  enrolled: {
    label: "Enrolled",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  no_show: {
    label: "No Show",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  },
};

const subStatusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  past_due: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  trialing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeAgo(d: string | null | undefined) {
  if (!d) return "Never";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

function formatMinutes(seconds: number) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function StudentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const api = useApiKeyClient();
  const [student, setStudent] = useState<StudentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStudent() {
      try {
        const data = await api.students.get(id);
        setStudent(data);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    fetchStudent();
  }, [id, api]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-6 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="glass-subtle h-32 animate-pulse rounded-xl" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-subtle h-24 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Link
          href="/dashboard/students"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Students
        </Link>
        <div className="glass-subtle flex flex-col items-center justify-center rounded-xl py-16 text-center">
          <User className="mb-3 h-10 w-10 text-zinc-400" />
          <p className="font-medium text-zinc-500">Student not found</p>
        </div>
      </div>
    );
  }

  const totalHours = Math.round((student.totalMinutes / 60) * 10) / 10;
  const exercisesDone = student.exercises.filter((e) => e.isCompleted).length;
  const memberSinceDays = Math.floor(
    (Date.now() - new Date(student.firstSeenAt).getTime()) / 86400000,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Link
          href="/dashboard/students"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Students
        </Link>

        <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
              <User className="h-7 w-7 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  {student.name || "Unnamed Student"}
                </h1>
                <Badge
                  variant="secondary"
                  className={
                    student.isActive
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                  }
                >
                  {student.isActive ? "Active" : "Inactive"}
                </Badge>
                {student.cefrEstimate && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      cefrColors[student.cefrEstimate] ?? cefrColors.B1
                    }`}
                  >
                    {student.cefrEstimate}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                {student.email}
              </p>
            </div>
            <div className="hidden text-right text-xs text-zinc-400 sm:block">
              <p>Member since {formatDate(student.firstSeenAt)}</p>
              <p className="mt-0.5">{memberSinceDays} days on the platform</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards — 6 compact cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Classes Attended", value: student.attendedClasses, icon: Calendar, color: "text-violet-500 bg-violet-100 dark:bg-violet-900/30" },
          { label: "Total Hours", value: `${totalHours}h`, icon: Clock, color: "text-amber-500 bg-amber-100 dark:bg-amber-900/30" },
          { label: "Speaking Time", value: formatMinutes(student.totalSpeakingSeconds), icon: Mic, color: "text-blue-500 bg-blue-100 dark:bg-blue-900/30" },
          { label: "Exercises Done", value: exercisesDone, icon: BookOpen, color: "text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30" },
          { label: "AI Reports", value: student.aiReports.length, icon: FileText, color: "text-pink-500 bg-pink-100 dark:bg-pink-900/30" },
          { label: "Last Connection", value: timeAgo(student.lastConnection), icon: LogIn, color: "text-cyan-500 bg-cyan-100 dark:bg-cyan-900/30", small: true },
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
                <p className={`font-bold ${kpi.small ? "text-lg" : "text-xl"}`}>{kpi.value}</p>
                <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                  {kpi.label}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Gamification KPIs */}
      {(student.streak || student.totalXp > 0) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="glass-subtle rounded-xl border border-zinc-200/40 p-4 dark:border-zinc-700/40">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-orange-500 bg-orange-100 dark:bg-orange-900/30">
                <Flame className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold">{student.streak?.currentStreak ?? 0}</p>
                <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">Current Streak</p>
              </div>
            </div>
          </div>
          <div className="glass-subtle rounded-xl border border-zinc-200/40 p-4 dark:border-zinc-700/40">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-indigo-500 bg-indigo-100 dark:bg-indigo-900/30">
                <Zap className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold">{student.totalXp}</p>
                <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">Total XP</p>
              </div>
            </div>
          </div>
          <div className="glass-subtle rounded-xl border border-zinc-200/40 p-4 dark:border-zinc-700/40">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-teal-500 bg-teal-100 dark:bg-teal-900/30">
                <Calendar className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold">{student.streak?.totalActivityDays ?? 0}</p>
                <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">Active Days</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student Preferences */}
      {student.onboardingCompleted && (
        <div className="glass-subtle rounded-xl border border-zinc-200/40 p-5 dark:border-zinc-700/40">
          <div className="mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-semibold">Student Preferences</h2>
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">
              Onboarded
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">Native Language</p>
              <p className="text-sm font-medium">{getLanguageDisplay(student.nativeLanguage)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">Learning Language</p>
              <p className="text-sm font-medium">{getLanguageDisplay(student.learningLanguage)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">Self-Assessed Level</p>
              <p className="text-sm font-medium">{student.selfAssessedLevel || "—"}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">Daily Goal</p>
              <p className="text-sm font-medium">{student.dailyGoalMinutes} min</p>
            </div>
            {student.learningGoal && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">Learning Goal</p>
                <p className="text-sm font-medium capitalize">{student.learningGoal}</p>
              </div>
            )}
            {student.occupation && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">Occupation</p>
                <p className="text-sm font-medium capitalize">{student.occupation}</p>
              </div>
            )}
            {student.interests && student.interests.length > 0 && (
              <div className="col-span-2">
                <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Interests</p>
                <div className="flex flex-wrap gap-1.5">
                  {student.interests.map((interest) => (
                    <span
                      key={interest}
                      className="inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs capitalize dark:bg-zinc-800"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subscription + Teachers row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Active Subscription */}
        <div className="glass-subtle rounded-xl border border-zinc-200/40 p-5 dark:border-zinc-700/40">
          <div className="mb-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-semibold">Subscription</h2>
          </div>
          {student.activeSubscription ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{student.activeSubscription.planName}</span>
                <Badge
                  variant="secondary"
                  className={subStatusColors[student.activeSubscription.status] ?? ""}
                >
                  {student.activeSubscription.status}
                </Badge>
              </div>
              <div className="flex items-baseline gap-1 text-2xl font-bold">
                {student.activeSubscription.planPrice}
                <span className="text-sm font-normal text-zinc-500">
                  {student.activeSubscription.currency}/{student.activeSubscription.periodicity ?? "month"}
                </span>
              </div>
              {student.activeSubscription.currentPeriodEnd && (
                <p className="text-xs text-zinc-500">
                  Next billing: {formatDate(student.activeSubscription.currentPeriodEnd)}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">No active subscription</p>
          )}
        </div>

        {/* Teachers */}
        <div className="glass-subtle rounded-xl border border-zinc-200/40 p-5 dark:border-zinc-700/40">
          <div className="mb-3 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-semibold">Teachers</h2>
          </div>
          {student.teachers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {student.teachers.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-sm dark:bg-zinc-800"
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-200 text-[10px] font-bold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                    {t.name.charAt(0).toUpperCase()}
                  </div>
                  {t.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">No classes with teachers yet</p>
          )}
        </div>
      </div>

      {/* Activity Chart */}
      <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
        <h2 className="mb-4 text-sm font-semibold">Weekly Activity (Last 8 Weeks)</h2>
        <div className="h-52">
          {student.weeklyActivity.some((w) => w.classes > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={student.weeklyActivity}>
                <defs>
                  <linearGradient id="colorClasses" x1="0" y1="0" x2="0" y2="1">
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
                <Area type="monotone" dataKey="classes" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorClasses)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-400">
              No class activity in the last 8 weeks
            </div>
          )}
        </div>
      </div>

      {/* Class History */}
      <div className="glass-subtle overflow-hidden rounded-xl border border-zinc-200/40 dark:border-zinc-700/40">
        <div className="p-5 pb-0">
          <h2 className="mb-3 text-sm font-semibold">
            Class History
            <span className="ml-2 text-xs font-normal text-zinc-400">
              ({student.classHistory.length} classes)
            </span>
          </h2>
        </div>
        {student.classHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200/40 dark:border-zinc-700/40">
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Date</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Title</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Teacher</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Lang</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Duration</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {student.classHistory.map((cls) => {
                  const badge = classStatusBadge[cls.status] ?? {
                    label: cls.status,
                    className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
                  };
                  return (
                    <tr key={cls.classId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td className="whitespace-nowrap px-5 py-2.5 text-zinc-600 dark:text-zinc-400">
                        {new Date(cls.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td className="px-5 py-2.5 font-medium">{cls.title}</td>
                      <td className="px-5 py-2.5 text-zinc-600 dark:text-zinc-400">{cls.teacherName ?? "—"}</td>
                      <td className="px-5 py-2.5 capitalize text-zinc-500">{cls.language}</td>
                      <td className="px-5 py-2.5 text-zinc-600 dark:text-zinc-400">{cls.durationMinutes}m</td>
                      <td className="px-5 py-2.5">
                        <Badge variant="secondary" className={badge.className}>{badge.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center py-10 text-sm text-zinc-400">
            No class history yet
          </div>
        )}
      </div>

      {/* AI Reports */}
      <div className="glass-subtle overflow-hidden rounded-xl border border-zinc-200/40 dark:border-zinc-700/40">
        <div className="p-5 pb-0">
          <h2 className="mb-3 text-sm font-semibold">
            AI Class Reports
            <span className="ml-2 text-xs font-normal text-zinc-400">
              ({student.aiReports.length})
            </span>
          </h2>
        </div>
        {student.aiReports.length > 0 ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {student.aiReports.map((report) => (
              <div key={report.reportId} className="px-5 py-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-pink-500" />
                      <span className="font-medium">{report.roomTitle ?? "Class Report"}</span>
                      <span className="text-xs text-zinc-400">{formatDate(report.createdAt)}</span>
                    </div>
                    {report.summary && (
                      <p className="mt-1.5 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {report.summary}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-4 text-xs text-zinc-500">
                    <div className="text-center">
                      <p className="font-bold text-zinc-700 dark:text-zinc-300">
                        {formatMinutes(report.speakingTime)}
                      </p>
                      <p>Speaking</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-zinc-700 dark:text-zinc-300">
                        {Math.round(report.speakingRatio * 100)}%
                      </p>
                      <p>Ratio</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-zinc-700 dark:text-zinc-300">
                        {report.vocabularyCount}
                      </p>
                      <p>Vocab</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-zinc-700 dark:text-zinc-300">
                        {report.grammarErrorCount}
                      </p>
                      <p>Errors</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-10 text-sm text-zinc-400">
            No AI reports yet
          </div>
        )}
      </div>

      {/* Subscription History */}
      {student.subscriptionHistory.length > 0 && (
        <div className="glass-subtle overflow-hidden rounded-xl border border-zinc-200/40 dark:border-zinc-700/40">
          <div className="p-5 pb-0">
            <h2 className="mb-3 text-sm font-semibold">Subscription History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200/40 dark:border-zinc-700/40">
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Plan</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Price</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Status</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Started</th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Cancelled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {student.subscriptionHistory.map((sub) => (
                  <tr key={sub.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                    <td className="px-5 py-2.5 font-medium">{sub.planName}</td>
                    <td className="px-5 py-2.5 text-zinc-600 dark:text-zinc-400">
                      {sub.planPrice} {sub.currency}
                    </td>
                    <td className="px-5 py-2.5">
                      <Badge variant="secondary" className={subStatusColors[sub.status] ?? ""}>
                        {sub.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-2.5 text-zinc-500">{formatDate(sub.createdAt)}</td>
                    <td className="px-5 py-2.5 text-zinc-500">{formatDate(sub.cancelledAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
