"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiClient } from "@/lib/api";
import { RefreshCw, ArrowRight, Award, Brain, Star } from "lucide-react";
import type { ReviewStats } from "@langopia/api-client";

export default function ReviewPage() {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getApiClient()
      .studentApp.reviewStats()
      .then((data) => setStats(data || { dueToday: 0, total: 0, mastered: 0 }))
      .catch(() => setStats({ dueToday: 0, total: 0, mastered: 0 }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="px-2 py-6 md:px-3">
      <h1 className="font-display text-2xl font-bold mb-5">Repaso</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="animate-fade-in-up rounded-2xl bg-accent p-4 text-center" style={{ "--stagger": 0 } as React.CSSProperties}>
          <div className="flex justify-center mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
              <RefreshCw className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="font-display text-2xl font-bold text-primary">{stats?.dueToday || 0}</div>
          <div className="text-xs text-muted-foreground">Pendientes</div>
        </div>
        <div className="animate-fade-in-up rounded-2xl bg-card p-4 text-center shadow-sm" style={{ "--stagger": 1 } as React.CSSProperties}>
          <div className="flex justify-center mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-course-sky/15">
              <Brain className="h-5 w-5 text-course-sky" />
            </div>
          </div>
          <div className="font-display text-2xl font-bold">{stats?.total || 0}</div>
          <div className="text-xs text-muted-foreground">Activas</div>
        </div>
        <div className="animate-fade-in-up rounded-2xl bg-card p-4 text-center shadow-sm" style={{ "--stagger": 2 } as React.CSSProperties}>
          <div className="flex justify-center mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <Star className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <div className="font-display text-2xl font-bold text-green-600">{stats?.mastered || 0}</div>
          <div className="text-xs text-muted-foreground">Dominadas</div>
        </div>
      </div>

      {/* Start review CTA */}
      {(stats?.dueToday ?? 0) > 0 ? (
        <Link
          href="/review/session"
          className="animate-fade-in-up flex items-center justify-between rounded-2xl bg-gradient-to-r from-primary to-primary/85 p-5 text-primary-foreground shadow-lg transition-transform hover:scale-[1.01]"
          style={{ "--stagger": 3 } as React.CSSProperties}
        >
          <div className="flex items-center gap-3">
            <RefreshCw className="h-6 w-6" />
            <div>
              <div className="font-display font-bold">Empezar repaso</div>
              <div className="text-sm opacity-80">{stats?.dueToday} elementos listos</div>
            </div>
          </div>
          <ArrowRight className="h-5 w-5" />
        </Link>
      ) : (
        <div className="animate-fade-in-up rounded-2xl bg-green-50 p-6 text-center" style={{ "--stagger": 3 } as React.CSSProperties}>
          <Award className="mx-auto mb-2 h-10 w-10 text-green-500" />
          <p className="font-display font-bold text-green-700">¡Todo al día!</p>
          <p className="text-sm text-green-600">No hay elementos pendientes de repaso</p>
        </div>
      )}
    </div>
  );
}
