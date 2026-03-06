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
  MessageSquare,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useApiKeyClient } from "@/hooks/use-api-client";
import { Badge } from "@/components/ui/badge";

interface Student {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  totalRooms: number;
  totalMinutes: number;
  cefrEstimate: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

// Mock data for activity chart (classes per week over last 8 weeks)
const activityData = [
  { week: "W1", classes: 3 },
  { week: "W2", classes: 5 },
  { week: "W3", classes: 2 },
  { week: "W4", classes: 4 },
  { week: "W5", classes: 6 },
  { week: "W6", classes: 3 },
  { week: "W7", classes: 5 },
  { week: "W8", classes: 4 },
];

// Mock data for class history
const classHistory = [
  {
    id: "1",
    date: "2026-03-04",
    teacher: "Maria Lopez",
    course: "Business English B2",
    duration: "60 min",
    status: "attended" as const,
  },
  {
    id: "2",
    date: "2026-03-01",
    teacher: "James Chen",
    course: "Conversational Spanish",
    duration: "45 min",
    status: "attended" as const,
  },
  {
    id: "3",
    date: "2026-02-27",
    teacher: "Maria Lopez",
    course: "Business English B2",
    duration: "60 min",
    status: "no_show" as const,
  },
  {
    id: "4",
    date: "2026-02-24",
    teacher: "Sophie Martin",
    course: "IELTS Preparation",
    duration: "90 min",
    status: "attended" as const,
  },
  {
    id: "5",
    date: "2026-02-20",
    teacher: "James Chen",
    course: "Conversational Spanish",
    duration: "45 min",
    status: "attended" as const,
  },
];

// Mock data for learning path progress
const learningPathData = [
  { course: "Business English B2", progress: 78 },
  { course: "Conv. Spanish", progress: 45 },
  { course: "IELTS Prep", progress: 62 },
  { course: "Grammar Advanced", progress: 30 },
  { course: "Pronunciation", progress: 90 },
];

const cefrColors: Record<string, string> = {
  A1: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  A2: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  B1: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  B2: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  C1: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  C2: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
};

export default function StudentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const api = useApiKeyClient();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStudent() {
      try {
        const data = await api.students.get(id);
        setStudent(data as unknown as Student);
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
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="glass-subtle h-28 animate-pulse rounded-xl"
            />
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
  // Mock KPI values
  const learningPathProgress = 64;
  const aiChatSessions = 12;

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
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
              <User className="h-7 w-7 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
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
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
              <Calendar className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Total Classes
              </p>
              <p className="text-2xl font-bold">{student.totalRooms}</p>
            </div>
          </div>
        </div>

        <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Total Hours
              </p>
              <p className="text-2xl font-bold">{totalHours}h</p>
            </div>
          </div>
        </div>

        <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Path Progress
              </p>
              <p className="text-2xl font-bold">{learningPathProgress}%</p>
            </div>
          </div>
        </div>

        <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                AI Chat Sessions
              </p>
              <p className="text-2xl font-bold">{aiChatSessions}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Chart */}
      <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
        <h2 className="mb-4 text-lg font-semibold">Weekly Activity</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activityData}>
              <defs>
                <linearGradient id="colorClasses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(161,161,170,0.2)"
              />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 12, fill: "#a1a1aa" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#a1a1aa" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(24,24,27,0.9)",
                  border: "1px solid rgba(63,63,70,0.4)",
                  borderRadius: "8px",
                  color: "#fafafa",
                  fontSize: "13px",
                }}
              />
              <Area
                type="monotone"
                dataKey="classes"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#colorClasses)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Class History */}
      <div className="glass-subtle overflow-hidden rounded-xl border border-zinc-200/40 dark:border-zinc-700/40">
        <div className="p-6 pb-0">
          <h2 className="mb-4 text-lg font-semibold">Class History</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200/40 dark:border-zinc-700/40">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Teacher
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Course
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {classHistory.map((cls) => (
              <tr
                key={cls.id}
                className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30"
              >
                <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400">
                  {new Date(cls.date).toLocaleDateString()}
                </td>
                <td className="px-6 py-3 font-medium">{cls.teacher}</td>
                <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400">
                  {cls.course}
                </td>
                <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400">
                  {cls.duration}
                </td>
                <td className="px-6 py-3">
                  <Badge
                    variant="secondary"
                    className={
                      cls.status === "attended"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }
                  >
                    {cls.status === "attended" ? "Attended" : "No Show"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Learning Path Progress */}
      <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
        <h2 className="mb-4 text-lg font-semibold">Learning Path Progress</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={learningPathData}
              layout="vertical"
              margin={{ left: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(161,161,170,0.2)"
                horizontal={false}
              />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 12, fill: "#a1a1aa" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="course"
                tick={{ fontSize: 12, fill: "#a1a1aa" }}
                axisLine={false}
                tickLine={false}
                width={120}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(24,24,27,0.9)",
                  border: "1px solid rgba(63,63,70,0.4)",
                  borderRadius: "8px",
                  color: "#fafafa",
                  fontSize: "13px",
                }}
                formatter={(value: number | undefined) => [`${value ?? 0}%`, "Progress"]}
              />
              <Bar
                dataKey="progress"
                fill="#10b981"
                radius={[0, 4, 4, 0]}
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
