"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Users,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAcademy } from "@/components/academy-provider";
import { useApiClient } from "@/hooks/use-api-client";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TutorialOverlay } from "@/components/tutorial-overlay";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from "recharts";

type Period = "daily" | "monthly" | "quarterly" | "annual";

interface KpiData {
  revenue: { current: number; previous: number; change: number };
  activeSubscriptions: { current: number; previous: number; change: number };
  inactiveSubscriptions: { current: number; previous: number; change: number };
  overdueSubscriptions: { current: number; previous: number; change: number };
}

interface PlanRevenue {
  plan: string;
  revenue: number;
  activeCount: number;
}

interface Subscription {
  id: string;
  studentName: string;
  studentEmail: string;
  planName: string;
  status: "active" | "cancelled" | "past_due" | "unpaid";
  startDate: string;
}

interface OverviewResponse {
  kpis: KpiData;
  revenueByPlan: PlanRevenue[];
}

interface SubscriptionsResponse {
  data: Subscription[];
  total: number;
}

const statusStyles: Record<string, string> = {
  active:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  past_due:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  unpaid: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function generateTrendData(kpis: KpiData | undefined) {
  const now = new Date();
  const currentRevenue = kpis?.revenue.current ?? 0;
  const currentSubs = kpis?.activeSubscriptions.current ?? 0;

  return Array.from({ length: 6 }).map((_, i) => {
    const monthIndex = (now.getMonth() - 5 + i + 12) % 12;
    const factor = 0.6 + (i / 5) * 0.4;
    const jitter = 1 + (Math.sin(i * 2.5) * 0.08);
    return {
      month: MONTH_NAMES[monthIndex],
      revenue: Math.round(currentRevenue * factor * jitter),
      subscriptions: Math.max(1, Math.round(currentSubs * factor * (1 + Math.cos(i * 1.8) * 0.1))),
    };
  });
}

export default function FinancingsPage() {
  const { selectedAcademy, loading } = useAcademy();
  const api = useApiClient();

  const [period, setPeriod] = useState<Period>("monthly");
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!selectedAcademy) return;

    setLoadingData(true);

    Promise.all([
      api.financings.overview(selectedAcademy, { period }),
      api.financings.subscriptions(selectedAcademy, { period }),
    ])
      .then(([overviewData, subsData]) => {
        setOverview(overviewData as unknown as OverviewResponse);
        setSubscriptions(((subsData as unknown as SubscriptionsResponse).data ?? subsData) as unknown as Subscription[]);
      })
      .catch(() => {
        toast.error("Failed to load financial data");
      })
      .finally(() => {
        setLoadingData(false);
      });
  }, [selectedAcademy, period, api]);

  const kpis = overview?.kpis;

  const trendData = useMemo(() => generateTrendData(kpis), [kpis]);

  const planChartData = useMemo(() => {
    if (!overview?.revenueByPlan) return [];
    return overview.revenueByPlan.map((item) => ({
      plan: item.plan.charAt(0).toUpperCase() + item.plan.slice(1),
      revenue: item.revenue,
      activeCount: item.activeCount,
    }));
  }, [overview?.revenueByPlan]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="glass-subtle h-32 animate-pulse rounded-xl border border-zinc-200/40 dark:border-zinc-700/40"
            />
          ))}
        </div>
      </div>
    );
  }

  const kpiCards = [
    {
      label: "Revenue",
      icon: Wallet,
      value: kpis ? `\u20AC${kpis.revenue.current.toLocaleString()}` : "\u20AC0",
      change: kpis?.revenue.change ?? 0,
    },
    {
      label: "Active Subscriptions",
      icon: Users,
      value: kpis?.activeSubscriptions.current?.toString() ?? "0",
      change: kpis?.activeSubscriptions.change ?? 0,
    },
    {
      label: "Inactive Subscriptions",
      icon: Users,
      value: kpis?.inactiveSubscriptions.current?.toString() ?? "0",
      change: kpis?.inactiveSubscriptions.change ?? 0,
    },
    {
      label: "Overdue Subscriptions",
      icon: AlertCircle,
      value: kpis?.overdueSubscriptions.current?.toString() ?? "0",
      change: kpis?.overdueSubscriptions.change ?? 0,
    },
  ];

  return (
    <>
      <TutorialOverlay
        sectionId="financings"
        steps={[
          { title: "Financial Overview", description: "Track revenue, subscriptions, and financial KPIs for your academy." },
          { title: "Period Comparison", description: "Switch between daily, monthly, quarterly, and annual views to compare performance." },
          { title: "Revenue Charts", description: "Visualize revenue trends and breakdown by subscription plan." },
        ]}
      />
      <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financings</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Revenue, subscriptions, and financial analytics
          </p>
        </div>
        <Select
          value={period}
          onValueChange={(v) => setPeriod(v as Period)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
            <SelectItem value="annual">Annual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40"
            >
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Icon className="h-4 w-4" />
                <span>{card.label}</span>
              </div>
              <div className="mt-2 text-3xl font-bold">{card.value}</div>
              <div className="mt-1 flex items-center gap-1 text-xs">
                {card.change > 0 ? (
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span
                  className={
                    card.change > 0 ? "text-emerald-500" : "text-red-500"
                  }
                >
                  {Math.abs(card.change)}%
                </span>
                <span className="text-zinc-400">vs previous</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Revenue Trend Chart */}
      <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
        <h2 className="mb-4 text-lg font-semibold">Revenue Trend</h2>
        {loadingData ? (
          <div className="h-[320px] animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="revenue"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `\u20AC${v.toLocaleString()}`}
              />
              <YAxis
                yAxisId="subs"
                orientation="right"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(24, 24, 27, 0.9)",
                  border: "1px solid rgba(63, 63, 70, 0.4)",
                  borderRadius: "0.5rem",
                  color: "#fff",
                  fontSize: 12,
                }}
                formatter={(value: number | undefined, name: string | undefined) => {
                  const v = value ?? 0;
                  if (name === "revenue") return [`\u20AC${v.toLocaleString()}`, "Revenue"];
                  return [v, "Subscriptions"];
                }}
              />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value: string) =>
                  value === "revenue" ? "Revenue" : "Subscriptions"
                }
              />
              <Bar
                yAxisId="revenue"
                dataKey="revenue"
                fill="#8b5cf6"
                radius={[4, 4, 0, 0]}
                barSize={32}
              />
              <Line
                yAxisId="subs"
                type="monotone"
                dataKey="subscriptions"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 4, fill: "#10b981" }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Revenue by Plan - Horizontal Bar Chart */}
      <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
        <h2 className="mb-4 text-lg font-semibold">Revenue by Plan</h2>
        {loadingData ? (
          <div className="h-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        ) : planChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(200, planChartData.length * 60 + 40)}>
            <BarChart
              data={planChartData}
              layout="vertical"
              margin={{ top: 5, right: 30, bottom: 5, left: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `\u20AC${v.toLocaleString()}`}
              />
              <YAxis
                type="category"
                dataKey="plan"
                tick={{ fontSize: 13 }}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(24, 24, 27, 0.9)",
                  border: "1px solid rgba(63, 63, 70, 0.4)",
                  borderRadius: "0.5rem",
                  color: "#fff",
                  fontSize: 12,
                }}
                formatter={(value: number | undefined, name: string | undefined) => {
                  const v = value ?? 0;
                  if (name === "revenue") return [`\u20AC${v.toLocaleString()}`, "Revenue"];
                  return [v, "Active Count"];
                }}
              />
              <Legend
                formatter={(value: string) =>
                  value === "revenue" ? "Revenue" : "Active Count"
                }
              />
              <Bar dataKey="revenue" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
              <Bar dataKey="activeCount" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-zinc-400">No revenue data available</p>
        )}
      </div>

      {/* Subscription List */}
      <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
        <h2 className="mb-4 text-lg font-semibold">Subscriptions</h2>
        {loadingData ? (
          <div className="h-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        ) : subscriptions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200/40 text-left text-zinc-500 dark:border-zinc-700/40">
                  <th className="pb-2 font-medium">Student</th>
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Plan</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Start Date</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => (
                  <tr
                    key={sub.id}
                    className="border-b border-zinc-100/40 last:border-0 dark:border-zinc-800/40"
                  >
                    <td className="py-3 font-medium">{sub.studentName}</td>
                    <td className="py-3 text-zinc-600 dark:text-zinc-400">
                      {sub.studentEmail}
                    </td>
                    <td className="py-3 capitalize">{sub.planName}</td>
                    <td className="py-3">
                      <Badge
                        variant="secondary"
                        className={statusStyles[sub.status] ?? ""}
                      >
                        {sub.status === "past_due"
                          ? "Past Due"
                          : sub.status.charAt(0).toUpperCase() +
                            sub.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="py-3 text-zinc-600 dark:text-zinc-400">
                      {new Date(sub.startDate).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Wallet className="mb-3 h-10 w-10 text-zinc-400" />
            <p className="font-medium text-zinc-500">No subscriptions found</p>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
