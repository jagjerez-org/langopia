"use client";

import { useEffect, useState, useCallback } from "react";
import { Route, Plus, Filter, ChevronRight, Clock, BookOpen } from "lucide-react";
import { CEFR_LEVELS, EXERCISE_LANGUAGES } from "@langopia/shared/types";
import { toast } from "sonner";
import { useAcademy } from "@/components/academy-provider";
import { useRouter } from "next/navigation";

interface LearningPath {
  id: string;
  title: string;
  description: string | null;
  language: string;
  cefrLevel: string;
  status: string;
  thumbnailUrl: string | null;
  estimatedHours: number | null;
  lessonCount: number;
  createdAt: string;
  updatedAt: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  archived: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export default function LearningPathsPage() {
  const { selectedAcademy, selectedAcademyData, loading: academyLoading } = useAcademy();
  const router = useRouter();
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [total, setTotal] = useState(0);

  // Create form
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

  const loadPaths = useCallback(async () => {
    if (!apiKey) return;

    const params = new URLSearchParams({ limit: "100" });
    if (filterLanguage !== "all") params.set("language", filterLanguage);
    if (filterCefr !== "all") params.set("cefrLevel", filterCefr);
    if (filterStatus !== "all") params.set("status", filterStatus);

    const res = await fetch(`/api/v1/learning-paths?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const data = await res.json();
      setPaths(data.data ?? []);
      setTotal(data.total ?? 0);
    }
  }, [apiKey, filterLanguage, filterCefr, filterStatus]);

  useEffect(() => {
    setPaths([]);
    setTotal(0);
    if (selectedAcademy) loadPaths();
  }, [selectedAcademy, loadPaths]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey || !newTitle.trim()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/v1/learning-paths", {
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
        const lp = await res.json();
        setCreating(false);
        setNewTitle("");
        setNewDescription("");
        toast.success("Learning path created");
        router.push(`/dashboard/learning-paths/${lp.id}`);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to create learning path");
      }
    } finally {
      setSaving(false);
    }
  }

  const hasActiveFilters = filterLanguage !== "all" || filterCefr !== "all" || filterStatus !== "all";

  // Group by language
  const grouped = new Map<string, LearningPath[]>();
  for (const lp of paths) {
    const lang = EXERCISE_LANGUAGES.find((l) => l.code === lp.language)?.name ?? lp.language;
    if (!grouped.has(lang)) grouped.set(lang, []);
    grouped.get(lang)!.push(lp);
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
          <Route className="mb-3 h-10 w-10 text-zinc-400" />
          <p className="font-medium text-zinc-500">No academy selected</p>
          <p className="mt-1 text-sm text-zinc-400">Select an academy from the sidebar to view learning paths</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Learning Paths</h1>
          <p className="text-sm text-zinc-500">
            {paths.length} of {total} path{total !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-violet-500 hover:shadow-lg"
        >
          <Plus className="h-4 w-4" />
          New Path
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <form onSubmit={handleCreate} className="glass space-y-4 rounded-xl p-5">
          <h3 className="font-semibold">Create New Learning Path</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-zinc-500">Title *</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Business English B1 Course"
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
                placeholder="Optional description of the learning path..."
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
              {saving ? "Creating..." : "Create Path"}
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
          <option value="published">Published</option>
          <option value="archived">Archived</option>
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

      {/* Paths list */}
      {paths.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center rounded-xl py-16 text-center">
          <Route className="mb-3 h-10 w-10 text-zinc-400" />
          <p className="font-medium text-zinc-500">No learning paths yet</p>
          <p className="mt-1 text-sm text-zinc-400">Create your first learning path to organize lessons into a curriculum</p>
          <button
            onClick={() => setCreating(true)}
            className="mt-4 flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-violet-500"
          >
            <Plus className="h-4 w-4" />
            New Path
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([language, groupPaths]) => (
            <div key={language}>
              <h2 className="mb-3 text-sm font-semibold text-zinc-500">{language}</h2>
              <div className="space-y-2">
                {groupPaths.map((lp) => (
                  <button
                    key={lp.id}
                    onClick={() => router.push(`/dashboard/learning-paths/${lp.id}`)}
                    className="glass flex w-full items-center gap-4 rounded-xl p-4 text-left transition hover:shadow-md"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">
                      {lp.cefrLevel}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{lp.title}</h3>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[lp.status] ?? "bg-zinc-100 text-zinc-600"}`}>
                          {lp.status}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {lp.lessonCount} lesson{lp.lessonCount !== 1 ? "s" : ""}
                        </span>
                        {lp.estimatedHours && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {lp.estimatedHours}h
                          </span>
                        )}
                        {lp.description && <span className="truncate">{lp.description}</span>}
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
