"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BookOpen,
  Sparkles,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
  Filter,
  Eye,
  EyeOff,
  RefreshCw,
  Headphones,
  Pencil,
  Save,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { ExerciseWizard } from "@/components/exercise-wizard";
import { RegenerateDialog } from "@/components/regenerate-dialog";
import { ExerciseRenderer } from "@/components/exercises/exercise-renderer";
import { EXERCISE_TYPE_CONFIG, ExerciseType } from "@langopia/shared/types";
import { useAcademyLevels } from "@/hooks/use-academy-levels";
import { useAcademy } from "@/components/academy-provider";
import { useApiKeyClient } from "@/hooks/use-api-client";
import type { UpdateExerciseRequest } from "@langopia/api-client";

interface Exercise {
  id: string;
  type: string;
  targetSkill: string;
  topic: string | null;
  language?: string;
  title?: string | null;
  instruction: string;
  content: string;
  options: string[] | null;
  correctAnswer?: string;
  explanation?: string;
  cefrLevel: string;
  source: string;
  audioUrl?: string | null;
  videoUrl?: string | null;
  imageUrl?: string | null;
  createdAt: string;
}

// ─── Type icons/labels (from EXERCISE_TYPE_CONFIG) ──────────────
function getTypeLabel(type: string): string {
  const config = EXERCISE_TYPE_CONFIG[type as ExerciseType];
  return config?.label ?? type.replace(/_/g, " ");
}

function getTypeIcon(type: string) {
  const config = EXERCISE_TYPE_CONFIG[type as ExerciseType];
  if (!config) return <Sparkles className="h-4 w-4" />;
  const IconComp = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[config.icon];
  return IconComp ? <IconComp className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />;
}

const skillColors: Record<string, string> = {
  vocabulary: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  grammar: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  reading: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  writing: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  listening: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
};


// ─── Inline Edit Form ───────────────────────────────────────
function InlineEditForm({
  exercise,
  draft,
  onDraftChange,
  onSave,
  onCancel,
  saving,
  levelCodes,
}: {
  exercise: Exercise;
  draft: Partial<Exercise>;
  onDraftChange: (d: Partial<Exercise>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  levelCodes: string[];
}) {
  const hasOptions = exercise.options && exercise.options.length > 0;

  return (
    <div className="space-y-3 border-t border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/30">
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-500">Title</label>
        <input
          value={draft.title ?? exercise.title ?? ""}
          onChange={(e) => onDraftChange({ ...draft, title: e.target.value })}
          placeholder="Exercise title (optional)"
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-500">Instruction</label>
        <input
          value={draft.instruction ?? exercise.instruction}
          onChange={(e) => onDraftChange({ ...draft, instruction: e.target.value })}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-500">Content</label>
        <textarea
          value={draft.content ?? exercise.content}
          onChange={(e) => onDraftChange({ ...draft, content: e.target.value })}
          rows={2}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
      </div>
      {hasOptions && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-500">Options (one per line)</label>
          <textarea
            value={(draft.options ?? exercise.options ?? []).join("\n")}
            onChange={(e) => onDraftChange({ ...draft, options: e.target.value.split("\n") })}
            rows={4}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-500">Correct Answer</label>
          <input
            value={draft.correctAnswer ?? exercise.correctAnswer ?? ""}
            onChange={(e) => onDraftChange({ ...draft, correctAnswer: e.target.value })}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-500">CEFR Level</label>
          <select
            value={draft.cefrLevel ?? exercise.cefrLevel}
            onChange={(e) => onDraftChange({ ...draft, cefrLevel: e.target.value })}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            {levelCodes.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-500">Explanation</label>
        <textarea
          value={draft.explanation ?? exercise.explanation ?? ""}
          onChange={(e) => onDraftChange({ ...draft, explanation: e.target.value })}
          rows={2}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-500">Video URL</label>
          <input
            value={draft.videoUrl ?? exercise.videoUrl ?? ""}
            onChange={(e) => onDraftChange({ ...draft, videoUrl: e.target.value || null })}
            placeholder="https://..."
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-500">Image URL</label>
          <input
            value={draft.imageUrl ?? exercise.imageUrl ?? ""}
            onChange={(e) => onDraftChange({ ...draft, imageUrl: e.target.value || null })}
            placeholder="https://..."
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────
export default function ExercisesPage() {
  const { selectedAcademy, selectedAcademyData, loading: academyLoading } = useAcademy();
  const api = useApiKeyClient();
  const { levelCodes } = useAcademyLevels();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [total, setTotal] = useState(0);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Per-exercise preview and editing
  const [previewingIds, setPreviewingIds] = useState<Set<string>>(new Set());
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [editDrafts, setEditDrafts] = useState<Record<string, Partial<Exercise>>>({});
  const [savingEdits, setSavingEdits] = useState<Set<string>>(new Set());

  // AI token usage
  const [tokenUsage, setTokenUsage] = useState<{ used: number; limit: number } | null>(null);

  // Filters
  const [filterSkill, setFilterSkill] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCefrLevel, setFilterCefrLevel] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<"topic" | "level">("topic");

  // Collapsed groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Regenerate dialog
  const [regenerateExercise, setRegenerateExercise] = useState<Exercise | null>(null);

  const apiKey = selectedAcademyData?.apiKey;

  const loadTokenUsage = useCallback(async () => {
    if (!apiKey) return;
    try {
      const data = await api.usage.get();
      setTokenUsage({
        used: data.usage?.ai_tokens ?? 0,
        limit: data.limits?.maxAiTokensPerMonth ?? 0,
      });
    } catch { /* ignore */ }
  }, [apiKey, api]);

  useEffect(() => {
    if (selectedAcademy) {
      loadTokenUsage();
    }
  }, [selectedAcademy, loadTokenUsage]);

  const loadExercises = useCallback(async () => {
    if (!apiKey) return;

    try {
      const data = await api.exercises.list({ limit: 100 });
      setExercises((data.data ?? []) as unknown as Exercise[]);
      setTotal(data.total ?? 0);
    } catch { /* ignore */ }
  }, [apiKey, api]);

  useEffect(() => {
    setExercises([]);
    setTotal(0);
    setTokenUsage(null);
    if (selectedAcademy) loadExercises();
  }, [selectedAcademy, loadExercises]);

  async function handleDelete(id: string) {
    if (!apiKey) return;

    try {
      await api.exercises.delete(id);
      setExercises((prev) => prev.filter((ex) => ex.id !== id));
      setTotal((t) => t - 1);
    } catch { /* ignore */ }
  }

  function handleRegenerateClick(exercise: Exercise) {
    setRegenerateExercise(exercise);
  }

  async function handleSaveEdit(id: string) {
    if (!apiKey) return;
    const draft = editDrafts[id];
    if (!draft) return;

    setSavingEdits((prev) => new Set(prev).add(id));
    try {
      const updated = await api.exercises.update(id, draft as unknown as UpdateExerciseRequest);
      setExercises((prev) =>
        prev.map((ex) => (ex.id === id ? { ...ex, ...(updated as unknown as Exercise) } : ex))
      );
      setEditingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setEditDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } finally {
      setSavingEdits((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function togglePreview(id: string) {
    setPreviewingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleEdit(id: string) {
    setEditingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setEditDrafts((d) => {
          const n = { ...d };
          delete n[id];
          return n;
        });
      } else {
        next.add(id);
        setEditDrafts((d) => ({ ...d, [id]: {} }));
      }
      return next;
    });
  }

  // Apply client-side filters
  const filtered = exercises.filter((ex) => {
    if (filterSkill !== "all" && ex.targetSkill !== filterSkill) return false;
    if (filterType !== "all" && ex.type !== filterType) return false;
    if (filterCefrLevel !== "all" && ex.cefrLevel !== filterCefrLevel) return false;
    return true;
  });

  // Group exercises
  const grouped = new Map<string, Exercise[]>();
  if (groupBy === "level") {
    // Group by academy level in order
    for (const level of levelCodes) {
      const matching = filtered.filter((ex) => ex.cefrLevel === level);
      if (matching.length > 0) grouped.set(level, matching);
    }
    // Any exercises without a recognized level
    const uncategorized = filtered.filter((ex) => !levelCodes.includes(ex.cefrLevel));
    if (uncategorized.length > 0) grouped.set("Other", uncategorized);
  } else {
    for (const ex of filtered) {
      const topic = ex.topic || "Uncategorized";
      if (!grouped.has(topic)) grouped.set(topic, []);
      grouped.get(topic)!.push(ex);
    }
  }

  // Get unique values for filter dropdowns
  const skills = [...new Set(exercises.map((e) => e.targetSkill))];
  const types = [...new Set(exercises.map((e) => e.type))];

  const hasActiveFilters = filterSkill !== "all" || filterType !== "all" || filterCefrLevel !== "all";

  if (academyLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-8 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass h-32 animate-pulse rounded-xl" />
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
          <p className="mt-1 text-sm text-zinc-400">Select an academy from the sidebar to view exercises</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Exercises</h1>
          <p className="text-sm text-zinc-500">
            {filtered.length} of {total} exercises &middot; {grouped.size} {groupBy === "level" ? "level" : "topic"}{grouped.size !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* AI Token Credits */}
      {tokenUsage && (
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <span className="text-sm font-medium">AI Token Credits</span>
            </div>
            <span className="text-sm text-zinc-500">
              {tokenUsage.used.toLocaleString()} / {tokenUsage.limit.toLocaleString()} tokens
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className={`h-full rounded-full transition-all ${
                tokenUsage.used >= tokenUsage.limit
                  ? "bg-red-500"
                  : tokenUsage.used / tokenUsage.limit > 0.8
                  ? "bg-amber-500"
                  : "bg-violet-500"
              }`}
              style={{ width: `${Math.min((tokenUsage.used / tokenUsage.limit) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={() => setWizardOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:shadow-lg"
      >
        <Sparkles className="h-4 w-4" />
        Generate Exercises
      </button>

      {/* Exercise Wizard */}
      {apiKey && (
        <ExerciseWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          apiKey={apiKey}
          levelCodes={levelCodes}
          onComplete={() => {
            loadExercises();
            loadTokenUsage();
          }}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Filter className="h-3.5 w-3.5" /> Filters:
        </div>
        <select
          value={filterSkill}
          onChange={(e) => setFilterSkill(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="all">All skills</option>
          {skills.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="all">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>{getTypeLabel(t)}</option>
          ))}
        </select>
        <select
          value={filterCefrLevel}
          onChange={(e) => setFilterCefrLevel(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="all">All levels</option>
          {levelCodes.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>

        {/* Group toggle */}
        <div className="ml-auto flex rounded-lg border border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => setGroupBy("topic")}
            className={`rounded-l-lg px-2.5 py-1.5 text-xs font-medium transition ${
              groupBy === "topic"
                ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400"
                : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            By Topic
          </button>
          <button
            onClick={() => setGroupBy("level")}
            className={`rounded-r-lg px-2.5 py-1.5 text-xs font-medium transition ${
              groupBy === "level"
                ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400"
                : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            By Level
          </button>
        </div>

        {hasActiveFilters && (
          <button
            onClick={() => { setFilterSkill("all"); setFilterType("all"); setFilterCefrLevel("all"); }}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {/* Exercise groups */}
      <div className="space-y-6">
        {[...grouped.entries()].map(([groupKey, groupExercises]) => {
          const isCollapsed = collapsedGroups.has(groupKey);
          return (
            <div key={groupKey}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(groupKey)}
                className="mb-3 flex w-full items-center gap-3 text-left"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
                )}
                <div className="flex flex-1 items-center gap-3">
                  <h2 className="text-base font-semibold capitalize">{groupKey}</h2>
                  <span className="text-xs text-zinc-500">
                    {groupExercises.length} exercise{groupExercises.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </button>

              {/* Exercises in this group */}
              {!isCollapsed && (
                <div className="space-y-3">
                  {groupExercises.map((ex) => (
                    <div key={ex.id} className="overflow-hidden rounded-xl border border-zinc-200/60 bg-white shadow-sm dark:border-zinc-700/60 dark:bg-zinc-900">
                      {/* Manage row */}
                      <div className="flex items-center gap-3 p-4">
                        <div className="flex-1">
                          <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            <span className="text-zinc-500">{getTypeIcon(ex.type)}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                skillColors[ex.targetSkill] ?? skillColors.vocabulary
                              }`}
                            >
                              {ex.targetSkill}
                            </span>
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                              {ex.cefrLevel}
                            </span>
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                              {getTypeLabel(ex.type)}
                            </span>
                          </div>
                          {ex.title && (
                            <p className="text-sm font-semibold">{ex.title}</p>
                          )}
                          <p className="text-sm font-medium">{ex.instruction}</p>
                          <p className="mt-0.5 text-sm text-zinc-500 line-clamp-1">{ex.content}</p>
                          {ex.audioUrl && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-violet-500">
                              <Headphones className="h-3 w-3" /> Audio available
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {/* Preview toggle */}
                          <button
                            onClick={() => togglePreview(ex.id)}
                            className={`rounded-md p-1.5 transition ${
                              previewingIds.has(ex.id)
                                ? "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
                                : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                            }`}
                            title={previewingIds.has(ex.id) ? "Hide preview" : "Preview"}
                          >
                            {previewingIds.has(ex.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                          {/* Edit toggle */}
                          <button
                            onClick={() => toggleEdit(ex.id)}
                            className={`rounded-md p-1.5 transition ${
                              editingIds.has(ex.id)
                                ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                                : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                            }`}
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {/* Regenerate */}
                          <button
                            onClick={() => handleRegenerateClick(ex)}
                            className="rounded-md p-1.5 text-zinc-400 hover:bg-violet-50 hover:text-violet-500 dark:hover:bg-violet-900/20"
                            title="Regenerate"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(ex.id)}
                            className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Inline preview */}
                      {previewingIds.has(ex.id) && (
                        <div className="border-t border-zinc-100 p-5 dark:border-zinc-800">
                          <ExerciseRenderer exercise={ex} mode="interactive" />
                        </div>
                      )}

                      {/* Inline edit form */}
                      {editingIds.has(ex.id) && (
                        <InlineEditForm
                          exercise={ex}
                          draft={editDrafts[ex.id] ?? {}}
                          onDraftChange={(d) => setEditDrafts((prev) => ({ ...prev, [ex.id]: d }))}
                          onSave={() => handleSaveEdit(ex.id)}
                          onCancel={() => toggleEdit(ex.id)}
                          saving={savingEdits.has(ex.id)}
                          levelCodes={levelCodes}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Empty states */}
        {filtered.length === 0 && exercises.length > 0 && (
          <div className="glass flex flex-col items-center justify-center rounded-xl py-12 text-center">
            <Filter className="mb-3 h-8 w-8 text-zinc-400" />
            <p className="font-medium text-zinc-500">No exercises match your filters</p>
            <button
              onClick={() => { setFilterSkill("all"); setFilterType("all"); setFilterCefrLevel("all"); }}
              className="mt-2 text-sm text-violet-600 hover:underline dark:text-violet-400"
            >
              Clear filters
            </button>
          </div>
        )}

        {exercises.length === 0 && (
          <div className="glass flex flex-col items-center justify-center rounded-xl py-16 text-center">
            <BookOpen className="mb-3 h-10 w-10 text-zinc-400" />
            <p className="font-medium text-zinc-500">No exercises yet</p>
            <p className="mt-1 text-sm text-zinc-400">
              Use the wizard to generate exercises from your material
            </p>
            <button
              onClick={() => setWizardOpen(true)}
              className="mt-4 flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-violet-500"
            >
              <Sparkles className="h-4 w-4" />
              Generate Exercises
            </button>
          </div>
        )}
      </div>

      {/* Regenerate dialog */}
      {regenerateExercise && apiKey && (
        <RegenerateDialog
          exerciseId={regenerateExercise.id}
          exerciseType={regenerateExercise.type}
          exerciseTargetSkill={regenerateExercise.targetSkill}
          exerciseInstruction={regenerateExercise.instruction}
          open={!!regenerateExercise}
          onOpenChange={(open) => { if (!open) setRegenerateExercise(null); }}
          onRegenerated={(newEx) => {
            setExercises((prev) =>
              prev.map((ex) => (ex.id === regenerateExercise.id ? { ...ex, ...newEx } as Exercise : ex))
            );
          }}
        />
      )}
    </div>
  );
}
