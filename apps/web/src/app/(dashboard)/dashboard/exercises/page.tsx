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
  Headphones,
  Pencil,
  Save,
  Plus,
  Loader2,
  Search,
  CheckSquare,
  Square,
  RefreshCw,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { ExerciseRenderer } from "@/components/exercises/exercise-renderer";
import { EXERCISE_TYPE_CONFIG, ExerciseType, TargetSkill } from "@langopia/shared/types";
import { useAcademyLevels } from "@/hooks/use-academy-levels";
import { useAcademy } from "@/components/academy-provider";
import { useApiKeyClient } from "@/hooks/use-api-client";
import { useTokenUsage } from "@/hooks/use-token-usage";
import type { UpdateExerciseRequest, CreateSingleExerciseRequest, RegenerateExerciseRequest } from "@langopia/api-client";
import { PageHeader, PageSkeleton, EmptyState, PrimaryAction, ListItem } from "@/components/dashboard-list";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

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
  lesson?: { id: string; title: string } | null;
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

const exerciseTypes = Object.values(ExerciseType);
const targetSkills = Object.values(TargetSkill);

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

// ─── Create Single Exercise Dialog ──────────────────────────
function CreateExerciseDialog({
  open,
  onClose,
  onCreated,
  levelCodes,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (ex: Exercise) => void;
  levelCodes: string[];
}) {
  const api = useApiKeyClient();
  const [mode, setMode] = useState<"prompt" | "manual">("prompt");
  const [creating, setCreating] = useState(false);

  // Shared fields
  const [language, setLanguage] = useState("en");
  const [cefrLevel, setCefrLevel] = useState(levelCodes[0] ?? "B1");
  const [topic, setTopic] = useState("");
  const [type, setType] = useState<string>(ExerciseType.TAP_TO_COMPLETE);
  const [targetSkill, setTargetSkill] = useState<string>(TargetSkill.VOCABULARY);

  // Prompt mode
  const [prompt, setPrompt] = useState("");

  // Manual mode
  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");
  const [content, setContent] = useState("");
  const [options, setOptions] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [explanation, setExplanation] = useState("");

  function resetForm() {
    setMode("prompt");
    setLanguage("en");
    setCefrLevel(levelCodes[0] ?? "B1");
    setTopic("");
    setType(ExerciseType.TAP_TO_COMPLETE);
    setTargetSkill(TargetSkill.VOCABULARY);
    setPrompt("");
    setTitle("");
    setInstruction("");
    setContent("");
    setOptions("");
    setCorrectAnswer("");
    setExplanation("");
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const body: CreateSingleExerciseRequest = {
        mode,
        language,
        cefrLevel,
        topic: topic || undefined,
        type: type || undefined,
        targetSkill: targetSkill || undefined,
      };

      if (mode === "prompt") {
        if (!prompt.trim()) {
          toast.error("Please enter a prompt");
          return;
        }
        body.prompt = prompt;
      } else {
        if (!instruction.trim() || !content.trim()) {
          toast.error("Instruction and content are required");
          return;
        }
        body.title = title || undefined;
        body.instruction = instruction;
        body.content = content;
        body.options = options.trim() ? options.split("\n").filter(Boolean) : undefined;
        body.correctAnswer = correctAnswer || undefined;
        body.explanation = explanation || undefined;
      }

      const result = await api.exercises.createSingle(body);
      onCreated(result.data as unknown as Exercise);
      toast.success("Exercise created");
      resetForm();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create exercise");
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;

  const inputClass = "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800";
  const labelClass = "text-xs font-medium text-zinc-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Create Exercise</h2>
          <button onClick={() => { resetForm(); onClose(); }} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="mb-5 flex rounded-lg border border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => setMode("prompt")}
            className={`flex-1 rounded-l-lg px-4 py-2 text-sm font-medium transition ${
              mode === "prompt"
                ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400"
                : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            <Sparkles className="mr-1.5 inline h-3.5 w-3.5" />
            AI Prompt
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 rounded-r-lg px-4 py-2 text-sm font-medium transition ${
              mode === "manual"
                ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400"
                : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            <Pencil className="mr-1.5 inline h-3.5 w-3.5" />
            Manual
          </button>
        </div>

        {/* Shared fields */}
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className={labelClass}>Language</label>
            <input value={language} onChange={(e) => setLanguage(e.target.value)} className={inputClass} placeholder="en" />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>CEFR Level</label>
            <select value={cefrLevel} onChange={(e) => setCefrLevel(e.target.value)} className={inputClass}>
              {levelCodes.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
              {exerciseTypes.map((t) => <option key={t} value={t}>{getTypeLabel(t)}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Target Skill</label>
            <select value={targetSkill} onChange={(e) => setTargetSkill(e.target.value)} className={inputClass}>
              {targetSkills.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className={labelClass}>Topic (optional)</label>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} className={inputClass} placeholder="e.g. Food & restaurants" />
          </div>
        </div>

        {/* Prompt mode */}
        {mode === "prompt" && (
          <div className="space-y-1">
            <label className={labelClass}>Describe the exercise you want to generate</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className={inputClass}
              placeholder="e.g. Create a tap-to-complete exercise about ordering food at a restaurant, with 4 sentences that have missing words..."
            />
          </div>
        )}

        {/* Manual mode */}
        {mode === "manual" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className={labelClass}>Title (optional)</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Instruction *</label>
              <input value={instruction} onChange={(e) => setInstruction(e.target.value)} className={inputClass} placeholder="e.g. Complete the sentences..." />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Content *</label>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} className={inputClass} placeholder="The main content of the exercise" />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Options (one per line)</label>
              <textarea value={options} onChange={(e) => setOptions(e.target.value)} rows={3} className={inputClass} placeholder={"Option A\nOption B\nOption C"} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className={labelClass}>Correct Answer</label>
                <input value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} className={inputClass} />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Explanation</label>
                <input value={explanation} onChange={(e) => setExplanation(e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={() => { resetForm(); onClose(); }}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "prompt" ? <Sparkles className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {creating ? "Creating..." : mode === "prompt" ? "Generate" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────
export default function ExercisesPage() {
  const { selectedAcademy, selectedAcademyData, loading: academyLoading } = useAcademy();
  const api = useApiKeyClient();
  const { levelCodes } = useAcademyLevels();
  const tokenUsage = useTokenUsage();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [total, setTotal] = useState(0);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);

  // Per-exercise preview and editing
  const [previewingIds, setPreviewingIds] = useState<Set<string>>(new Set());
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [editDrafts, setEditDrafts] = useState<Record<string, Partial<Exercise>>>({});
  const [savingEdits, setSavingEdits] = useState<Set<string>>(new Set());

  // Regenerate
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [regenPrompt, setRegenPrompt] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingBulk, setDeletingBulk] = useState(false);

  // Filters
  const [filterSkill, setFilterSkill] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCefrLevel, setFilterCefrLevel] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [groupBy, setGroupBy] = useState<"lesson" | "level">("lesson");

  // Collapsed groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const apiKey = selectedAcademyData?.apiKey;

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
    setSelectedIds(new Set());
    if (selectedAcademy) loadExercises();
  }, [selectedAcademy, loadExercises]);

  async function handleDelete(id: string) {
    if (!apiKey) return;
    try {
      await api.exercises.delete(id);
      setExercises((prev) => prev.filter((ex) => ex.id !== id));
      setTotal((t) => t - 1);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success("Exercise deleted");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete exercise";
      toast.error(message);
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setDeletingBulk(true);
    try {
      const ids = [...selectedIds];
      await Promise.all(ids.map((id) => api.exercises.delete(id)));
      setExercises((prev) => prev.filter((ex) => !selectedIds.has(ex.id)));
      setTotal((t) => t - ids.length);
      toast.success(`Deleted ${ids.length} exercise${ids.length !== 1 ? "s" : ""}`);
      setSelectedIds(new Set());
    } catch {
      toast.error("Failed to delete some exercises");
    } finally {
      setDeletingBulk(false);
    }
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
      toast.success("Exercise updated");
    } catch {
      toast.error("Failed to update exercise");
    } finally {
      setSavingEdits((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleRegenerate(id: string) {
    setRegenLoading(true);
    try {
      const body: RegenerateExerciseRequest = regenPrompt.trim()
        ? { customPrompt: regenPrompt.trim() }
        : {};
      const updated = await api.exercises.regenerate(id, body);
      setExercises((prev) =>
        prev.map((ex) => (ex.id === id ? { ...ex, ...(updated as unknown as Exercise) } : ex))
      );
      toast.success("Exercise regenerated");
      setRegeneratingId(null);
      setRegenPrompt("");
    } catch {
      toast.error("Failed to regenerate exercise");
    } finally {
      setRegenLoading(false);
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

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((e) => e.id)));
    }
  }

  // Apply client-side filters
  const filtered = exercises.filter((ex) => {
    if (filterSkill !== "all" && ex.targetSkill !== filterSkill) return false;
    if (filterType !== "all" && ex.type !== filterType) return false;
    if (filterCefrLevel !== "all" && ex.cefrLevel !== filterCefrLevel) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matches =
        (ex.topic?.toLowerCase().includes(q)) ||
        ex.instruction.toLowerCase().includes(q) ||
        ex.content.toLowerCase().includes(q) ||
        (ex.title?.toLowerCase().includes(q));
      if (!matches) return false;
    }
    return true;
  });

  // Group exercises
  const grouped = new Map<string, Exercise[]>();
  if (groupBy === "level") {
    for (const level of levelCodes) {
      const matching = filtered.filter((ex) => ex.cefrLevel === level);
      if (matching.length > 0) grouped.set(level, matching);
    }
    const uncategorized = filtered.filter((ex) => !levelCodes.includes(ex.cefrLevel));
    if (uncategorized.length > 0) grouped.set("Other", uncategorized);
  } else {
    for (const ex of filtered) {
      const lessonLabel = ex.lesson?.title ?? "Sin lección";
      if (!grouped.has(lessonLabel)) grouped.set(lessonLabel, []);
      grouped.get(lessonLabel)!.push(ex);
    }
  }

  // Get unique values for filter dropdowns
  const skills = [...new Set(exercises.map((e) => e.targetSkill))];
  const types = [...new Set(exercises.map((e) => e.type))];

  const hasActiveFilters = filterSkill !== "all" || filterType !== "all" || filterCefrLevel !== "all" || searchQuery.trim() !== "";

  if (academyLoading) {
    return <PageSkeleton />;
  }

  if (!selectedAcademy) {
    return (
      <div className="mx-auto max-w-6xl">
        <EmptyState icon={BookOpen} title="No academy selected" description="Select an academy from the sidebar to view exercises" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <PageHeader
        title="Exercise Bank"
        subtitle={`${filtered.length} of ${total} exercises \u00b7 ${grouped.size} ${groupBy === "level" ? "level" : "lesson"}${grouped.size !== 1 ? "s" : ""}`}
        extra={
          !tokenUsage.loading ? (
            <p className={`mt-1 text-xs font-medium ${tokenUsage.limit > 0 && tokenUsage.used / tokenUsage.limit > 0.8 ? "text-red-500" : "text-pink-500 dark:text-pink-400"}`}>
              <Sparkles className="mr-1 inline h-3 w-3" />
              AI Tokens: {tokenUsage.formatted}
            </p>
          ) : undefined
        }
        action={
          <PrimaryAction onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create Exercise
          </PrimaryAction>
        }
      />

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="glass flex items-center justify-between rounded-xl p-3">
          <span className="text-sm font-medium">
            {selectedIds.size} exercise{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Deselect all
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={deletingBulk}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              {deletingBulk ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete selected
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-zinc-400" />
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="h-8 w-48 pl-8 text-xs"
          />
        </div>
        <Select value={filterSkill} onValueChange={setFilterSkill}>
          <SelectTrigger className="h-8 w-auto min-w-[100px] text-xs">
            <SelectValue placeholder="All skills" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All skills</SelectItem>
            {skills.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 w-auto min-w-[100px] text-xs">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {types.map((t) => (
              <SelectItem key={t} value={t}>{getTypeLabel(t)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCefrLevel} onValueChange={setFilterCefrLevel}>
          <SelectTrigger className="h-8 w-auto min-w-[100px] text-xs">
            <SelectValue placeholder="All levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            {levelCodes.map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Group toggle */}
        <div className="ml-auto flex rounded-lg border border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => setGroupBy("lesson")}
            className={`rounded-l-lg px-2.5 py-1.5 text-xs font-medium transition ${
              groupBy === "lesson"
                ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400"
                : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            By Lesson
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
            onClick={() => { setFilterSkill("all"); setFilterType("all"); setFilterCefrLevel("all"); setSearchQuery(""); }}
            className="text-xs text-violet-600 hover:text-violet-500"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Select all toggle */}
      {filtered.length > 0 && (
        <button
          onClick={toggleSelectAll}
          className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          {selectedIds.size === filtered.length ? (
            <CheckSquare className="h-3.5 w-3.5 text-violet-500" />
          ) : (
            <Square className="h-3.5 w-3.5" />
          )}
          {selectedIds.size === filtered.length ? "Deselect all" : "Select all"}
        </button>
      )}

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
                    <ListItem
                      key={ex.id}
                      chevron={false}
                      avatar={
                        <button
                          onClick={() => toggleSelect(ex.id)}
                          className="shrink-0 text-zinc-400 hover:text-violet-500"
                        >
                          {selectedIds.has(ex.id) ? (
                            <CheckSquare className="h-4 w-4 text-violet-500" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      }
                      title={
                        <div>
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
                        </div>
                      }
                      subtitle={
                        <>
                          <span className="line-clamp-1">{ex.content}</span>
                          {ex.audioUrl && (
                            <span className="flex items-center gap-1 text-violet-500">
                              <Headphones className="h-3 w-3" /> Audio
                            </span>
                          )}
                        </>
                      }
                      actions={
                        <>
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
                          <button
                            onClick={() => {
                              setRegeneratingId(ex.id);
                              setRegenPrompt("");
                            }}
                            className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                            title="Regenerate"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(ex.id)}
                            className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      }
                    >
                      {previewingIds.has(ex.id) && (
                        <div className="border-t border-zinc-100 p-5 dark:border-zinc-800">
                          <ExerciseRenderer exercise={ex} mode="interactive" />
                        </div>
                      )}
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
                    </ListItem>
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
              onClick={() => { setFilterSkill("all"); setFilterType("all"); setFilterCefrLevel("all"); setSearchQuery(""); }}
              className="mt-2 text-sm text-violet-600 hover:underline dark:text-violet-400"
            >
              Clear filters
            </button>
          </div>
        )}

        {exercises.length === 0 && (
          <EmptyState
            icon={BookOpen}
            title="No exercises yet"
            description="Create your first exercise or generate exercises from a lesson"
            action={
              <div className="mt-4">
                <PrimaryAction onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Create Exercise
                </PrimaryAction>
              </div>
            }
          />
        )}
      </div>

      {/* Create Exercise Dialog */}
      <CreateExerciseDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(ex) => {
          setExercises((prev) => [ex, ...prev]);
          setTotal((t) => t + 1);
        }}
        levelCodes={levelCodes}
      />

      {/* Regenerate Modal */}
      {regeneratingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Regenerar ejercicio</h2>
              <button
                onClick={() => { setRegeneratingId(null); setRegenPrompt(""); }}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-sm text-zinc-500">
              {exercises.find((e) => e.id === regeneratingId)?.title
                ?? exercises.find((e) => e.id === regeneratingId)?.instruction
                ?? "Exercise"}
            </p>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">
                  Instrucciones adicionales (opcional)
                </label>
                <textarea
                  value={regenPrompt}
                  onChange={(e) => setRegenPrompt(e.target.value)}
                  rows={3}
                  placeholder="Ej: Hazlo más difícil, añade más distractores..."
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => { setRegeneratingId(null); setRegenPrompt(""); }}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleRegenerate(regeneratingId)}
                  disabled={regenLoading}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {regenLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {regenLoading ? "Regenerando..." : "Regenerar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
