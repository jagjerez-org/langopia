"use client";

import { useEffect, useState } from "react";
import { useAcademy } from "@/components/academy-provider";
import { useApiClient } from "@/hooks/use-api-client";

interface TokenUsage {
  used: number;
  limit: number;
  loading: boolean;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

export function useTokenUsage(): TokenUsage & { formatted: string } {
  const { selectedAcademy } = useAcademy();
  const api = useApiClient();
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedAcademy) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api.dashboard
      .usage(selectedAcademy)
      .then((res) => {
        setUsed(res.usage["ai_tokens"] ?? 0);
        setLimit(res.limits.maxAiTokensPerMonth);
      })
      .catch(() => {
        setUsed(0);
        setLimit(0);
      })
      .finally(() => setLoading(false));
  }, [selectedAcademy, api]);

  const formatted = loading
    ? "..."
    : `${formatCompact(used)} / ${formatCompact(limit)}`;

  return { used, limit, loading, formatted };
}
