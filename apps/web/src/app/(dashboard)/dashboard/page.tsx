"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useAcademy } from "@/components/academy-provider";
import {
  School,
  Calendar,
  FileText,
  Clock,
  Zap,
  Sparkles,
  Users,
  TrendingUp,
  BookOpen,
  Route,
} from "lucide-react";
import type { DashboardOverview, DashboardActivityDay } from "@langopia/api-client";
import { useApiClient } from "@/hooks/use-api-client";
import { Badge } from "@/components/ui/badge";
import { TutorialOverlay } from "@/components/tutorial-overlay";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DashboardOverviewPage() {
  const { user } = useAuth();
  const { academies, selectedAcademy } = useAcademy();
  const api = useApiClient();
  const [stats, setStats] = useState<DashboardOverview | null>(null);
  const [activityData, setActivityData] = useState<{ day: string; Classes: number; Hours: number }[]>([]);

  useEffect(() => {
    api.dashboard.overview().then(setStats).catch(() => {});
    api.dashboard.activity(7).then((data) => {
      setActivityData(
        data.map((d) => ({
          day: DAY_NAMES[new Date(d.date + "T00:00:00").getDay()],
          Classes: d.classes,
          Hours: d.hours,
        })),
      );
    }).catch(() => {});
  }, [api]);

  const cards = [
    { label: "Academies", value: stats?.totalAcademies ?? academies.length, icon: School, color: "from-violet-500 to-purple-600" },
    { label: "Classes", value: stats?.totalRooms ?? 0, icon: Calendar, color: "from-blue-500 to-cyan-600" },
    { label: "Reports", value: stats?.totalReports ?? 0, icon: FileText, color: "from-emerald-500 to-green-600" },
    { label: "Class Hours", value: stats?.totalClassHours ?? 0, icon: Clock, color: "from-amber-500 to-orange-600" },
    { label: "AI Tokens", value: stats?.totalTokens ?? 0, icon: Zap, color: "from-pink-500 to-rose-600" },
  ];

  const quickLinks = [
    { href: "/dashboard/classes", label: "Classes", icon: Calendar, description: "Schedule and manage classes" },
    { href: "/dashboard/courses", label: "Courses", icon: BookOpen, description: "Organize lesson content" },
    { href: "/dashboard/students", label: "Students", icon: Users, description: "View student profiles" },
    { href: "/dashboard/learning-paths", label: "Learning Paths", icon: Route, description: "Build learning journeys" },
    { href: "/dashboard/financings", label: "Financings", icon: TrendingUp, description: "Revenue and subscriptions" },
  ];

  return (
    <>
      <TutorialOverlay
        sectionId="overview"
        steps={[
          { title: "Welcome to Overview", description: "This is your command center. See key metrics across all your academies at a glance." },
          { title: "KPI Cards", description: "Track classes, reports, hours, and AI token usage in real-time." },
          { title: "Recent Activity", description: "Monitor your teaching activity over the past week with the activity chart." },
        ]}
      />
      <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back,{" "}
            <span className="text-gradient">{user?.name?.split(" ")[0] ?? "there"}</span>
          </h1>
          <p className="mt-1.5 text-zinc-500 dark:text-zinc-400">
            Here&apos;s an overview of your Langopia account
          </p>
        </div>
        <div className="glass-subtle hidden items-center gap-2 rounded-xl border border-zinc-200/40 px-4 py-2 text-sm font-medium text-zinc-500 md:flex dark:border-zinc-700/40 dark:text-zinc-400">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </div>
      </div>

      {/* Plan Badge */}
      <div className="glass-subtle flex items-center justify-between rounded-xl border border-zinc-200/40 px-5 py-3 dark:border-zinc-700/40">
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">Current Plan:</span>
          <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 capitalize">
            {user?.plan ?? "free"}
          </Badge>
        </div>
        <Link
          href="/dashboard/billing"
          className="text-sm font-medium text-violet-600 hover:text-violet-500 dark:text-violet-400"
        >
          {user?.plan === "free" ? "Upgrade Plan" : "Manage Billing"} →
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="glass-subtle rounded-2xl border border-zinc-200/40 p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-zinc-700/40">
              <div className="mb-3 flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${card.color} text-white shadow-sm`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="text-2xl font-bold">{card.value.toLocaleString()}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Recent Activity Chart */}
      <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <span className="text-xs text-zinc-400">Last 7 days</span>
        </div>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activityData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorClasses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.08} />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#a1a1aa" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#a1a1aa" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(24, 24, 27, 0.9)",
                  border: "1px solid rgba(63, 63, 70, 0.4)",
                  borderRadius: "0.75rem",
                  color: "#e4e4e7",
                  fontSize: "0.875rem",
                  backdropFilter: "blur(8px)",
                }}
              />
              <Area
                type="monotone"
                dataKey="Classes"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#colorClasses)"
              />
              <Area
                type="monotone"
                dataKey="Hours"
                stroke="#8b5cf6"
                strokeWidth={2}
                strokeDasharray="4 4"
                fill="url(#colorHours)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Access */}
      {selectedAcademy && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Quick Access</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="glass-subtle group flex flex-col gap-2 rounded-xl border border-zinc-200/40 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-700/40"
                >
                  <Icon className="h-5 w-5 text-zinc-400 transition-colors group-hover:text-violet-500" />
                  <div>
                    <p className="text-sm font-medium">{link.label}</p>
                    <p className="text-xs text-zinc-400">{link.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Onboarding Prompt */}
      {academies.length > 0 && !selectedAcademy && (
        <div className="glass-subtle rounded-xl border border-violet-200/40 bg-violet-50/50 p-6 text-center dark:border-violet-800/40 dark:bg-violet-950/20">
          <School className="mx-auto mb-3 h-10 w-10 text-violet-400" />
          <h3 className="text-lg font-semibold">Select an Academy</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Choose an academy from the sidebar to access its dashboard
          </p>
        </div>
      )}

      {academies.length === 0 && (
        <div className="glass-subtle rounded-xl border border-violet-200/40 bg-violet-50/50 p-8 text-center dark:border-violet-800/40 dark:bg-violet-950/20">
          <School className="mx-auto mb-3 h-12 w-12 text-violet-400" />
          <h3 className="text-xl font-semibold">Get Started</h3>
          <p className="mt-2 text-sm text-zinc-500">
            Create your first academy to start managing classes, students, and content
          </p>
          <Link
            href="/dashboard/onboarding"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-accent px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl"
          >
            <Sparkles className="h-4 w-4" />
            Start Onboarding
          </Link>
        </div>
      )}
    </div>
    </>
  );
}
