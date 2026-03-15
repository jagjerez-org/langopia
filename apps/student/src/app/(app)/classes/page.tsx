"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiClient } from "@/lib/api";
import { Calendar, Clock, User, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentClassItem } from "@langopia/api-client";

const TAB_COLORS: Record<string, string> = {
  upcoming: "border-l-course-teal",
  past: "border-l-muted-foreground/30",
};

export default function ClassesPage() {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [classes, setClasses] = useState<StudentClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getApiClient()
      .studentApp.classes(tab)
      .then((data) => setClasses(data || []))
      .catch(() => setClasses([]))
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="px-2 py-6 md:px-3">
      <h1 className="font-display text-2xl font-bold mb-4">Clases</h1>

      {/* Pill tabs */}
      <div className="mb-5 flex gap-2">
        {(["upcoming", "past"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full px-5 py-2 text-sm font-semibold transition-all",
              tab === t
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80",
            )}
          >
            {t === "upcoming" ? "Próximas" : "Pasadas"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-2xl bg-muted/50 p-8 text-center animate-fade-in-up">
          <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {tab === "upcoming" ? "No hay clases próximas" : "No hay clases pasadas"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {classes.map((cls, i) => (
            <Link
              key={cls.id}
              href={`/classes/${cls.id}`}
              className={cn(
                "animate-fade-in-up flex items-center gap-3 rounded-2xl border-l-4 bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
                TAB_COLORS[tab],
              )}
              style={{ "--stagger": i } as React.CSSProperties}
            >
              <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-secondary">
                <div className="font-display text-sm font-bold text-foreground">
                  {new Date(cls.scheduledAt).toLocaleDateString(undefined, { day: "numeric" })}
                </div>
                <div className="text-[10px] uppercase text-muted-foreground">
                  {new Date(cls.scheduledAt).toLocaleDateString(undefined, { month: "short" })}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{cls.title}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(cls.scheduledAt).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  <span>· {cls.durationMinutes} min</span>
                  {cls.teacher && (
                    <>
                      <User className="h-3 w-3" />
                      {cls.teacher.name}
                    </>
                  )}
                </div>
              </div>

              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
