"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { useAcademy } from "@/components/academy-provider";

interface UsageData {
  period: string;
  plan: string;
  usage: Record<string, number>;
  limits: {
    maxRoomsPerMonth: number;
    maxClassHoursPerMonth: number;
    maxReportsPerMonth: number;
    maxStudentsPerRoom: number;
    maxStorageBytes: number;
    maxAiTokensPerMonth: number;
  };
}

export default function UsagePage() {
  const { academies } = useAcademy();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);

  useEffect(() => {
    // Fetch usage from all academies that have apiKeys and aggregate
    const withKeys = academies.filter((a) => a.apiKey);
    if (withKeys.length === 0) {
      setLoadingUsage(false);
      return;
    }

    Promise.all(
      withKeys.map((a) =>
        fetch("/api/v1/usage", {
          headers: { Authorization: `Bearer ${a.apiKey}` },
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    ).then((results) => {
      const valid = results.filter(Boolean) as UsageData[];
      if (valid.length === 0) {
        setLoadingUsage(false);
        return;
      }

      // Limits and plan are per-user, same across all responses
      const first = valid[0];

      // Sum usage across all academies
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
  }, [academies]);

  const metrics = usage
    ? [
        {
          label: "Rooms Created",
          value: usage.usage.rooms_created ?? 0,
          limit: usage.limits.maxRoomsPerMonth,
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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => {
          const pct =
            metric.limit != null && metric.limit > 0
              ? Math.min((metric.value / metric.limit) * 100, 100)
              : 0;
          const isOver = metric.limit != null && metric.value >= metric.limit;

          return (
            <div key={metric.label} className="glass rounded-xl p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                {metric.label}
              </p>
              <p className="mt-2 text-2xl font-bold">
                {metric.value.toLocaleString()}
                <span className="ml-1 text-sm font-normal text-zinc-400">
                  {metric.unit}
                </span>
              </p>
              {metric.limit != null && (
                <>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isOver
                          ? "bg-red-500"
                          : pct > 80
                          ? "bg-amber-500"
                          : "bg-violet-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {metric.limit.toLocaleString()} {metric.unit} limit
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>

      {loadingUsage && !usage && (
        <div className="glass flex flex-col items-center justify-center rounded-xl py-16 text-center">
          <BarChart3 className="mb-3 h-10 w-10 text-zinc-400" />
          <p className="font-medium text-zinc-500">Loading usage data...</p>
        </div>
      )}
    </div>
  );
}
