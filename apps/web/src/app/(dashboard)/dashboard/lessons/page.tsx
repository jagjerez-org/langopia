"use client";

import { useEffect, useState, useCallback } from "react";
import { BookOpen, Plus, Filter, ChevronRight } from "lucide-react";
import { CEFR_LEVELS, EXERCISE_LANGUAGES } from "@langopia/shared/types";
import { toast } from "sonner";
import { useAcademy } from "@/components/academy-provider";
import { useRouter } from "next/navigation";

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  language: string;
  cefrLevel: string;
  status: string;
  exerciseCount: number;
  createdAt: string;
  updatedAt: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  ready: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  completed: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export default function LessonsPage() {
  const { selectedAcademy, selectedAcademyData, loading: academyLoading } = useAcademy();
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [total, setTotal] = useState(0);

  // Create lesson form
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newLanguage, setNewLanguage] = useState("en");
  const [newCefrLevel, setNewCefrLevel] = useState("B1");
  const [newDescription, setNewDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterLanguage, setFilterLanguage] = useState<string>("all");
  const [filterCefr, setFilterCefr] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const apiKey = selectedAcademyData?.apiKey;

  const loadLessons = useCallback(async () => {
    if (!apiKey) return;

    const params = new URLSearchParams({ limit: "100" });
    if (filterLanguage !== "all") params.set("language", filterLanguage);
    if (filterCefr !== "all") params.set("cefrLevel", filterCefr);
    if (filterStatus !== "all") params.set("status", filterStatus);

    const res = await fetch(`/api/v1/lessons?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const data = await res.json();
      setLessons(data.data ?? []);
      setTotal(data.total ?? 0);
    }
  }, [apiKey, filterLanguage, filterCefr, filterStatus]);

  useEffect(() => {
    setLessons([]);
    setTotal(0);
    if (selectedAcademy) loadLessons();
  }, [selectedAcademy, loadLessons]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey || !newTitle.trim()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/v1/lessons", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newTitle,
          language: newLanguage,
          cefrLevel: newCefrLevel,
          description: newDescription || undefined,
        }),
      });

      if (res.ok) {
        const lesson = await res.json();
        setCreating(false);
        setNewTitle("");
        setNewDescription("");
        toast.success("Lesson created");
        router.push(`/dashboard/lessons/${lesson.id}`);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to create lesson");
      }
    } finally {
      setSaving(false);
    }
  }

  const hasActiveFilters = filterLanguage !== "all" || filterCefr !== "all" || filterStatus !== "all";

  // Group by language
  const grouped = new Map<string, Lesson[]>();
  for (const lesson of lessons) {
    const lang = EXERCISE_LANGUAGES.find((l) => l.code === lesson.language)?.name ?? lesson.language;
    if (!grouped.has(lang)) grouped.set(lang, []);
    grouped.get(lang)!.push(lesson);
  }

  if (academyLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-8 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass h-24 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!selectedAcademy) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="glass flex flex-col items-center justify-center rounded-xl py-16 text-center">
          <BookOpen className="mb-3 h-10 w-10 text-zinc-400" />
          <p className="font-medium text-zinc-500">No academy selected</p>
          <p className="mt-1 text-sm text-zinc-400">Select an academy from the sidebar to view lessons</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lessons</h1>
          <p className="text-sm text-zinc-500">
            {lessons.length} of {total} lesson{total !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-violet-500 hover:shadow-lg"
        >
          <Plus className="h-4 w-4" />
          New Lesson
        </button>
      </div>

      {/* Create lesson form */}
      {creating && (
        <form onSubmit={handleCreate} className="glass space-y-4 rounded-xl p-5">
          <h3 className="font-semibold">Create New Lesson</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-zinc-500">Title *</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Business English - Negotiations"
                required
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-violet-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500">Language</label>
              <select
                value={newLanguage}
                onChange={(e) => setNewLanguage(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                {EXERCISE_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500">CEFR Level *</label>
              <select
                value={newCefrLevel}
                onChange={(e) => setNewCefrLevel(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                {CEFR_LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-zinc-500">Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional lesson description..."
                rows={2}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-violet-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving || !newTitle.trim()}
              className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Lesson"}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-lg px-4 py-2 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-zinc-400" />
        <select
          value={filterLanguage}
          onChange={(e) => setFilterLanguage(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="all">All languages</option>
          {EXERCISE_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.name}</option>
          ))}
        </select>
        <select
          value={filterCefr}
          onChange={(e) => setFilterCefr(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="all">All levels</option>
          {CEFR_LEVELS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="all">All status</option>
          <option value="draft">Draft</option>
          <option value="ready">Ready</option>
          <option value="completed">Completed</option>
        </select>
        {hasActiveFilters && (
          <button
            onClick={() => { setFilterLanguage("all"); setFilterCefr("all"); setFilterStatus("all"); }}
            className="text-xs text-violet-600 hover:text-violet-500"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Lessons list */}
      {lessons.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center rounded-xl py-16 text-center">
          <BookOpen className="mb-3 h-10 w-10 text-zinc-400" />
          <p className="font-medium text-zinc-500">No lessons yet</p>
          <p className="mt-1 text-sm text-zinc-400">Create your first lesson to get started</p>
          <button
            onClick={() => setCreating(true)}
            className="mt-4 flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-violet-500"
          >
            <Plus className="h-4 w-4" />
            New Lesson
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([language, groupLessons]) => (
            <div key={language}>
              <h2 className="mb-3 text-sm font-semibold text-zinc-500">{language}</h2>
              <div className="space-y-2">
                {groupLessons.map((lesson) => (
                  <button
                    key={lesson.id}
                    onClick={() => router.push(`/dashboard/lessons/${lesson.id}`)}
                    className="glass flex w-full items-center gap-4 rounded-xl p-4 text-left transition hover:shadow-md"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-bold text-white">
                      {lesson.cefrLevel}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{lesson.title}</h3>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[lesson.status] ?? "bg-zinc-100 text-zinc-600"}`}>
                          {lesson.status}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-zinc-500">
                        <span>{lesson.exerciseCount} exercise{lesson.exerciseCount !== 1 ? "s" : ""}</span>
                        <span>{new Date(lesson.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
