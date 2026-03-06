"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  GraduationCap,
  Calendar,
  Clock,
  Star,
  Users,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useApiKeyClient } from "@/hooks/use-api-client";
import {
  BarChart,
  Bar,
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

interface Teacher {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

// --- Mock data generators ---

function getMonthLabel(monthsAgo: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  return d.toLocaleString("default", { month: "short", year: "2-digit" });
}

const teachingHoursData = Array.from({ length: 6 }, (_, i) => ({
  month: getMonthLabel(5 - i),
  hours: Math.floor(Math.random() * 30) + 10,
}));

const ratingDistributionData = [
  { rating: "5 stars", count: 42, fill: "#8b5cf6" },
  { rating: "4 stars", count: 28, fill: "#a78bfa" },
  { rating: "3 stars", count: 12, fill: "#c4b5fd" },
  { rating: "2 stars", count: 4, fill: "#ddd6fe" },
  { rating: "1 star", count: 1, fill: "#ede9fe" },
];

const CEFR_COLORS: Record<string, string> = {
  A1: "#22c55e",
  A2: "#84cc16",
  B1: "#eab308",
  B2: "#f97316",
  C1: "#ef4444",
  C2: "#8b5cf6",
};

const studentDistributionData = [
  { level: "A1", count: 8 },
  { level: "A2", count: 14 },
  { level: "B1", count: 22 },
  { level: "B2", count: 18 },
  { level: "C1", count: 7 },
  { level: "C2", count: 3 },
];

const recentClassesData = [
  {
    date: "2026-03-05",
    students: "Maria Garcia",
    course: "Business English B2",
    duration: "60 min",
    rating: 5,
  },
  {
    date: "2026-03-04",
    students: "Lucas Fernandez, Ana Lopez",
    course: "IELTS Prep",
    duration: "90 min",
    rating: 4,
  },
  {
    date: "2026-03-03",
    students: "Yuki Tanaka",
    course: "Conversational A2",
    duration: "45 min",
    rating: 5,
  },
  {
    date: "2026-03-01",
    students: "Pierre Dupont",
    course: "Academic Writing C1",
    duration: "60 min",
    rating: 4,
  },
  {
    date: "2026-02-28",
    students: "Sara Kim, Jin Park",
    course: "General English B1",
    duration: "60 min",
    rating: 5,
  },
  {
    date: "2026-02-27",
    students: "Marco Rossi",
    course: "Travel English A1",
    duration: "45 min",
    rating: 3,
  },
];

// --- Component ---

export default function TeacherDetailPage() {
  const params = useParams<{ id: string }>();
  const api = useApiKeyClient();

  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchTeacher = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await api.teachers.get(params.id);
      setTeacher(data as unknown as Teacher);
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
      <div className="mx-auto max-w-6xl space-y-6">
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
      <div className="mx-auto max-w-6xl space-y-6">
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

  // Mock KPIs
  const totalClasses = 87;
  const totalHours = teachingHoursData.reduce((sum, d) => sum + d.hours, 0);
  const avgRating = 4.6;
  const activeStudents = studentDistributionData.reduce(
    (sum, d) => sum + d.count,
    0,
  );

  const kpis = [
    {
      label: "Total Classes",
      value: totalClasses,
      icon: Calendar,
      color: "text-violet-500",
    },
    {
      label: "Total Hours",
      value: `${totalHours}h`,
      icon: Clock,
      color: "text-blue-500",
    },
    {
      label: "Avg. Rating",
      value: avgRating.toFixed(1),
      icon: Star,
      color: "text-amber-500",
    },
    {
      label: "Active Students",
      value: activeStudents,
      icon: Users,
      color: "text-emerald-500",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
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
            <h1 className="text-2xl font-bold tracking-tight">
              {teacher.name}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {teacher.email}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {teacher.roles.map((role) => (
              <Badge key={role} variant="secondary" className="capitalize">
                {role}
              </Badge>
            ))}
          </div>
          <div className="text-right text-xs text-zinc-400">
            <span>Joined Mar 2025</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 ${kpi.color}`}
              >
                <kpi.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpi.value}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {kpi.label}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Teaching Hours Chart */}
        <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
          <h2 className="mb-4 text-sm font-semibold">
            Teaching Hours (Last 6 Months)
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teachingHoursData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(113,113,122,0.2)"
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  stroke="rgba(113,113,122,0.5)"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="rgba(113,113,122,0.5)"
                />
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
          </div>
        </div>

        {/* Rating Distribution Chart */}
        <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
          <h2 className="mb-4 text-sm font-semibold">Rating Distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratingDistributionData} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(113,113,122,0.2)"
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12 }}
                  stroke="rgba(113,113,122,0.5)"
                />
                <YAxis
                  type="category"
                  dataKey="rating"
                  tick={{ fontSize: 12 }}
                  stroke="rgba(113,113,122,0.5)"
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(24,24,27,0.9)",
                    border: "1px solid rgba(113,113,122,0.3)",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {ratingDistributionData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Student Distribution */}
      <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
        <h2 className="mb-4 text-sm font-semibold">
          Student Distribution by CEFR Level
        </h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={studentDistributionData}
                dataKey="count"
                nameKey="level"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                label={({ name, value }: { name?: string; value?: number }) => `${name ?? ""}: ${value ?? 0}`}
              >
                {studentDistributionData.map((entry) => (
                  <Cell
                    key={entry.level}
                    fill={CEFR_COLORS[entry.level]}
                    stroke="none"
                  />
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

      {/* Recent Classes Table */}
      <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
        <h2 className="mb-4 text-sm font-semibold">Recent Classes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200/40 text-left text-xs text-zinc-500 dark:border-zinc-700/40">
                <th className="pb-3 pr-4 font-medium">Date</th>
                <th className="pb-3 pr-4 font-medium">Student(s)</th>
                <th className="pb-3 pr-4 font-medium">Course</th>
                <th className="pb-3 pr-4 font-medium">Duration</th>
                <th className="pb-3 font-medium">Rating</th>
              </tr>
            </thead>
            <tbody>
              {recentClassesData.map((cls, i) => (
                <tr
                  key={i}
                  className="border-b border-zinc-100/40 last:border-0 dark:border-zinc-800/40"
                >
                  <td className="py-3 pr-4 text-zinc-600 dark:text-zinc-400">
                    {new Date(cls.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="py-3 pr-4">{cls.students}</td>
                  <td className="py-3 pr-4 text-zinc-600 dark:text-zinc-400">
                    {cls.course}
                  </td>
                  <td className="py-3 pr-4 text-zinc-600 dark:text-zinc-400">
                    {cls.duration}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }, (_, si) => (
                        <Star
                          key={si}
                          className={`h-3.5 w-3.5 ${
                            si < cls.rating
                              ? "fill-amber-500 text-amber-500"
                              : "text-zinc-300 dark:text-zinc-600"
                          }`}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
