"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { useAcademy } from "@/components/academy-provider";
import { useApiClient } from "@/hooks/use-api-client";
import type { DashboardUsageResponse } from "@langopia/api-client";
import {
  RadialBarChart,
  RadialBar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";

const METRIC_COLORS: Record<string, string> = {
  "Rooms Created": "#8b5cf6",   // violet-500
  "Class Minutes": "#3b82f6",   // blue-500
  "AI Reports": "#10b981",      // emerald-500
  "AI Tokens": "#ec4899",       // pink-500
  Storage: "#f59e0b",           // amber-500
};

const OVER_COLOR = "#ef4444"; // red-500

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

interface MetricDef {
  label: string;
  value: number;
  limit: number;
  unit: string;
}

function GaugeCard({ metric }: { metric: MetricDef }) {
  const pct =
    metric.limit > 0 ? Math.min((metric.value / metric.limit) * 100, 100) : 0;
  const isWarning = pct > 80;
  const baseColor = METRIC_COLORS[metric.label] ?? "#8b5cf6";
  const fillColor = isWarning ? OVER_COLOR : baseColor;

  const data = [
    { name: "used", value: pct, fill: fillColor },
  ];

  return (
    <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {metric.label}
      </p>
      <div className="relative mx-auto mt-2 h-[160px] w-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="70%"
            outerRadius="100%"
            startAngle={210}
            endAngle={-30}
            barSize={14}
            data={data}
          >
            <RadialBar
              dataKey="value"
              cornerRadius={8}
              background={{ fill: "rgba(113,113,122,0.15)" }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{formatCompact(metric.value)}</span>
          <span className="text-xs text-zinc-400">{metric.unit}</span>
        </div>
      </div>
      <p className="mt-1 text-center text-xs text-zinc-500">
        {formatCompact(metric.value)} / {formatCompact(metric.limit)} {metric.unit}
        <span
          className="ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{
            backgroundColor: isWarning ? "rgba(239,68,68,0.15)" : "rgba(139,92,246,0.15)",
            color: fillColor,
          }}
        >
          {Math.round(pct)}%
        </span>
      </p>
    </div>
  );
}

export default function UsagePage() {
  const { academies } = useAcademy();
  const api = useApiClient();
  const [usage, setUsage] = useState<DashboardUsageResponse | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);

  useEffect(() => {
    if (academies.length === 0) {
      setLoadingUsage(false);
      return;
    }

    Promise.all(
      academies.map((a) =>
        api.dashboard.usage(a.id).catch(() => null)
      )
    ).then((results) => {
      const valid = results.filter(Boolean) as DashboardUsageResponse[];
      if (valid.length === 0) {
        setLoadingUsage(false);
        return;
      }

      const first = valid[0];
      const aggregated: Record<string, number> = {};
      for (const r of valid) {
        for (const [key, val] of Object.entries(r.usage)) {
          aggregated[key] = (aggregated[key] ?? 0) + Number(val);
        }
      }

      setUsage({
        period: first.period,
        plan: first.plan,
        usage: aggregated,
        limits: first.limits,
      });
      setLoadingUsage(false);
    });
  }, [academies, api]);

  const metrics: MetricDef[] = usage
    ? [
        {
          label: "Rooms Created",
          value: usage.usage.rooms_created ?? 0,
          limit: usage.limits.maxClassesPerMonth,
          unit: "rooms",
        },
        {
          label: "Class Minutes",
          value: usage.usage.class_minutes ?? 0,
          limit: usage.limits.maxClassHoursPerMonth * 60,
          unit: "min",
        },
        {
          label: "AI Reports",
          value: usage.usage.ai_reports ?? 0,
          limit: usage.limits.maxReportsPerMonth,
          unit: "reports",
        },
        {
          label: "AI Tokens",
          value: usage.usage.ai_tokens ?? 0,
          limit: usage.limits.maxAiTokensPerMonth,
          unit: "tokens",
        },
        {
          label: "Storage",
          value: Math.round((usage.usage.storage_bytes ?? 0) / 1024 / 1024),
          limit: Math.round(usage.limits.maxStorageBytes / 1024 / 1024),
          unit: "MB",
        },
      ]
    : [];

  const barData = metrics.map((m) => ({
    name: m.label,
    Usage: m.value,
    Limit: m.limit,
    color: (m.limit > 0 && m.value / m.limit > 0.8)
      ? OVER_COLOR
      : METRIC_COLORS[m.label] ?? "#8b5cf6",
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Usage</h1>
        <p className="text-sm text-zinc-500">
          {usage?.period ?? ""}{usage ? " · " : ""}Plan:{" "}
          <span className="font-medium capitalize">{usage?.plan ?? "..."}</span>
          {academies.length > 1 && (
            <span className="text-zinc-400"> · Aggregated across all academies</span>
          )}
        </p>
      </div>

      {loadingUsage && !usage && (
        <div className="glass-subtle flex flex-col items-center justify-center rounded-xl border border-zinc-200/40 py-16 text-center dark:border-zinc-700/40">
          <BarChart3 className="mb-3 h-10 w-10 text-zinc-400" />
          <p className="font-medium text-zinc-500">Loading usage data...</p>
        </div>
      )}

      {/* Radial gauge cards */}
      {metrics.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {metrics.map((metric) => (
            <GaugeCard key={metric.label} metric={metric} />
          ))}
        </div>
      )}

      {/* Comparison bar chart */}
      {barData.length > 0 && (
        <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Usage vs Limits
          </h2>
          <div className="h-[340px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(113,113,122,0.2)"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#71717a" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#71717a" }}
                  tickFormatter={formatCompact}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(24,24,27,0.9)",
                    border: "1px solid rgba(63,63,70,0.5)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "#fafafa",
                  }}
                  formatter={(value: number | undefined) => formatCompact(value ?? 0)}
                  cursor={{ fill: "rgba(113,113,122,0.08)" }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  iconType="circle"
                  iconSize={8}
                />
                <Bar dataKey="Usage" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {barData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
                <Bar
                  dataKey="Limit"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                  fill="rgba(113,113,122,0.25)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
