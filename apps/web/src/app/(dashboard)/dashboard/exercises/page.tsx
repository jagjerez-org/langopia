"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  BookOpen,
  Sparkles,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Filter,
  Eye,
  EyeOff,
  Lightbulb,
  RefreshCw,
  Volume2,
  Pause,
  Play,
  Headphones,
  Upload,
  FileText,
  Pencil,
  Plus,
  Minus,
  Save,
  Settings2,
} from "lucide-react";
import { CEFR_LEVELS, EXERCISE_LANGUAGES } from "@langopia/shared/types";
import { toast } from "sonner";
import { useAcademy } from "@/components/academy-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Exercise {
  id: string;
  type: string;
  targetSkill: string;
  topic: string | null;
  language?: string;
  instruction: string;
  content: string;
  options: string[] | null;
  correctAnswer?: string;
  explanation?: string;
  cefrLevel: string;
  source: string;
  templateId?: string | null;
  audioUrl?: string | null;
  createdAt: string;
}

interface ExerciseTemplateData {
  id: string;
  slug: string;
  name: string;
  promptTemplate: string;
  targetSkill: string | null;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
}

// ─── Type icons/labels ──────────────────────────────────────
const typeConfig: Record<string, { label: string; icon: string }> = {
  fill_in_blank: { label: "Fill in the Blank", icon: "✏️" },
  multiple_choice: { label: "Multiple Choice", icon: "🔘" },
  sentence_reorder: { label: "Sentence Reorder", icon: "🔀" },
  error_correction: { label: "Error Correction", icon: "🔍" },
  free_response: { label: "Free Response", icon: "💬" },
  listening: { label: "Listening", icon: "🎧" },
};

function getTypeLabel(type: string, templates: ExerciseTemplateData[]): string {
  if (typeConfig[type]) return typeConfig[type].label;
  const t = templates.find((t) => t.slug === type);
  return t?.name ?? type.replace(/_/g, " ");
}

function getTypeIcon(type: string): string {
  return typeConfig[type]?.icon ?? "📝";
}

const skillColors: Record<string, string> = {
  vocabulary: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  grammar: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  reading: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  writing: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  listening: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
};

// ─── Audio Player ────────────────────────────────────────────
function AudioPlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    function onEnded() { setPlaying(false); }
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, []);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
      <button
        onClick={toggle}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-md transition hover:bg-violet-500"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-zinc-400" />
          <span className="text-xs font-medium text-zinc-500">
            {playing ? "Playing audio..." : "Click to play"}
          </span>
        </div>
      </div>
      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  );
}

// ─── Exercise Content Preview (read-only bank view) ─────────
function ExercisePreview({ exercise }: { exercise: Exercise }) {
  const [showAnswer, setShowAnswer] = useState(false);

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
        {exercise.instruction}
      </div>
      {exercise.audioUrl && <AudioPlayer src={exercise.audioUrl} />}

      {/* Content */}
      {exercise.type === "fill_in_blank" ? (
        <div className="flex flex-wrap items-baseline gap-1 text-lg leading-relaxed">
          {exercise.content.split(/(_+|___+|\[blank\]|\[___\])/gi).map((part, i) =>
            /^(_+|___+|\[blank\]|\[___\])$/i.test(part) ? (
              <span key={i} className="inline-block border-b-2 border-violet-300 px-2 py-0.5 font-semibold text-violet-600 dark:border-violet-600 dark:text-violet-400">
                {showAnswer ? exercise.correctAnswer || "___" : "___"}
              </span>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </div>
      ) : exercise.type === "error_correction" ? (
        <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-4 text-lg italic dark:border-amber-700 dark:bg-amber-900/10">
          &ldquo;{exercise.content}&rdquo;
        </div>
      ) : (
        <div className="text-lg">{exercise.content}</div>
      )}

      {/* Options (for multiple choice, listening, sentence reorder) */}
      {exercise.options && exercise.options.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {exercise.options.map((opt, i) => {
            const letter = String.fromCharCode(65 + i);
            const isCorrectOpt = showAnswer && opt === exercise.correctAnswer;
            return (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-xl border-2 p-3 ${
                  isCorrectOpt
                    ? "border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-900/20"
                    : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800/50"
                }`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                  isCorrectOpt
                    ? "bg-emerald-500 text-white"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
                }`}>
                  {isCorrectOpt ? <Check className="h-3.5 w-3.5" /> : letter}
                </span>
                <span className="text-sm">{opt}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Show/Hide Answer + Explanation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowAnswer(!showAnswer)}
          className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-500 dark:text-violet-400"
        >
          {showAnswer ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showAnswer ? "Hide answer" : "Show answer"}
        </button>
      </div>

      {showAnswer && (
        <div className="space-y-3">
          {exercise.correctAnswer && (
            <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-900/20">
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Correct Answer</p>
              <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{exercise.correctAnswer}</p>
            </div>
          )}
          {exercise.explanation && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
              <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                <Lightbulb className="h-3.5 w-3.5" /> Explanation
              </div>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">{exercise.explanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Inline Edit Form ───────────────────────────────────────
function InlineEditForm({
  exercise,
  draft,
  onDraftChange,
  onSave,
  onCancel,
  saving,
}: {
  exercise: Exercise;
  draft: Partial<Exercise>;
  onDraftChange: (d: Partial<Exercise>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const hasOptions = exercise.type === "multiple_choice" || exercise.type === "listening" || exercise.type === "sentence_reorder";

  return (
    <div className="space-y-3 border-t border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/30">
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
            {CEFR_LEVELS.map((l) => (
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
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [total, setTotal] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [genTopic, setGenTopic] = useState("");
  const [genFiles, setGenFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Templates
  const [templates, setTemplates] = useState<ExerciseTemplateData[]>([]);
  const [genLanguage, setGenLanguage] = useState("en");
  const [genCefrLevel, setGenCefrLevel] = useState("B1");
  const [genCounts, setGenCounts] = useState<Record<string, number>>({});

  // Per-exercise preview and editing
  const [previewingIds, setPreviewingIds] = useState<Set<string>>(new Set());
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [editDrafts, setEditDrafts] = useState<Record<string, Partial<Exercise>>>({});
  const [savingEdits, setSavingEdits] = useState<Set<string>>(new Set());

  // Template management
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingTemplatePrompt, setEditingTemplatePrompt] = useState("");
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateSkill, setNewTemplateSkill] = useState("vocabulary");
  const [newTemplatePrompt, setNewTemplatePrompt] = useState("");

  // AI token usage
  const [tokenUsage, setTokenUsage] = useState<{ used: number; limit: number } | null>(null);

  // Filters
  const [filterSkill, setFilterSkill] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCefrLevel, setFilterCefrLevel] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<"topic" | "level">("topic");

  // Collapsed groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Regenerating exercises
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());

  const apiKey = selectedAcademyData?.apiKey;

  // Delete template confirmation
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  const loadTokenUsage = useCallback(async () => {
    if (!apiKey) return;
    try {
      const res = await fetch("/api/v1/usage", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTokenUsage({
          used: data.usage?.ai_tokens ?? 0,
          limit: data.limits?.maxAiTokensPerMonth ?? 0,
        });
      }
    } catch { /* ignore */ }
  }, [apiKey]);

  const loadTemplates = useCallback(async () => {
    if (!apiKey) return;
    try {
      const res = await fetch("/api/v1/exercises/templates", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        const tpls = data.data ?? [];
        setTemplates(tpls);
        // Initialize counts with 0 for each template
        setGenCounts((prev) => {
          const next: Record<string, number> = {};
          for (const t of tpls) {
            next[t.id] = prev[t.id] ?? 0;
          }
          return next;
        });
      }
    } catch { /* ignore */ }
  }, [apiKey]);

  useEffect(() => {
    if (selectedAcademy) {
      loadTokenUsage();
      loadTemplates();
    }
  }, [selectedAcademy, loadTokenUsage, loadTemplates]);

  const loadExercises = useCallback(async () => {
    if (!apiKey) return;

    const params = new URLSearchParams({ limit: "100" });
    const res = await fetch(`/api/v1/exercises?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const data = await res.json();
      setExercises(data.data ?? []);
      setTotal(data.total ?? 0);
    }
  }, [apiKey]);

  useEffect(() => {
    setExercises([]);
    setTotal(0);
    setTemplates([]);
    setTokenUsage(null);
    if (selectedAcademy) loadExercises();
  }, [selectedAcademy, loadExercises]);

  const totalGenCount = Object.values(genCounts).reduce((s, c) => s + c, 0);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!genTopic.trim() || totalGenCount === 0) return;
    if (!apiKey) return;

    setGenerating(true);
    try {
      const templateRequests = Object.entries(genCounts)
        .filter(([, count]) => count > 0)
        .map(([templateId, count]) => ({ templateId, count }));

      let res: Response;

      if (genFiles.length > 0) {
        const formData = new FormData();
        formData.append("topic", genTopic);
        formData.append("language", genLanguage);
        formData.append("cefrLevel", genCefrLevel);
        formData.append("templates", JSON.stringify(templateRequests));
        for (const f of genFiles) {
          formData.append("file", f);
        }
        res = await fetch("/api/v1/exercises", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: formData,
        });
      } else {
        res = await fetch("/api/v1/exercises", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            topic: genTopic,
            language: genLanguage,
            cefrLevel: genCefrLevel,
            templates: templateRequests,
          }),
        });
      }

      if (res.status === 403) {
        const data = await res.json();
        toast.error(data.error || "AI token limit exceeded. Please upgrade your plan.");
        return;
      }

      if (res.ok) {
        setGenTopic("");
        setGenFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        // Reset counts
        setGenCounts((prev) => {
          const next: Record<string, number> = {};
          for (const k of Object.keys(prev)) next[k] = 0;
          return next;
        });
        loadExercises();
        loadTokenUsage();
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!apiKey) return;

    const res = await fetch(`/api/v1/exercises/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      setExercises((prev) => prev.filter((ex) => ex.id !== id));
      setTotal((t) => t - 1);
    }
  }

  async function handleRegenerate(id: string) {
    if (!apiKey) return;

    setRegeneratingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/v1/exercises/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const newExercise = await res.json();
        setExercises((prev) =>
          prev.map((ex) => (ex.id === id ? newExercise : ex))
        );
      }
    } finally {
      setRegeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleSaveEdit(id: string) {
    if (!apiKey) return;
    const draft = editDrafts[id];
    if (!draft) return;

    setSavingEdits((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/v1/exercises/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        const updated = await res.json();
        setExercises((prev) =>
          prev.map((ex) => (ex.id === id ? { ...ex, ...updated } : ex))
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
      }
    } finally {
      setSavingEdits((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleSaveTemplatePrompt(templateId: string) {
    if (!apiKey) return;

    await fetch(`/api/v1/exercises/templates/${templateId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ promptTemplate: editingTemplatePrompt }),
    });

    setEditingTemplateId(null);
    loadTemplates();
  }

  async function handleCreateTemplate() {
    if (!apiKey || !newTemplateName.trim() || !newTemplatePrompt.trim()) return;

    const res = await fetch("/api/v1/exercises/templates", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: newTemplateName,
        targetSkill: newTemplateSkill,
        promptTemplate: newTemplatePrompt,
      }),
    });

    if (res.ok) {
      setCreatingTemplate(false);
      setNewTemplateName("");
      setNewTemplateSkill("vocabulary");
      setNewTemplatePrompt("");
      loadTemplates();
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to create template");
    }
  }

  async function handleDeleteTemplate(id: string) {
    if (!apiKey) return;

    const res = await fetch(`/api/v1/exercises/templates/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      loadTemplates();
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
    // Group by CEFR level in order
    for (const level of CEFR_LEVELS) {
      const matching = filtered.filter((ex) => ex.cefrLevel === level);
      if (matching.length > 0) grouped.set(level, matching);
    }
    // Any exercises without a recognized level
    const uncategorized = filtered.filter((ex) => !(CEFR_LEVELS as readonly string[]).includes(ex.cefrLevel));
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

      {/* Generate form */}
      <form onSubmit={handleGenerate} className="glass space-y-4 rounded-xl p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-violet-500" />
          <span className="text-sm font-semibold">Generate Exercises</span>
        </div>

        {/* Topic + File */}
        <div className="flex items-center gap-3">
          <input
            value={genTopic}
            onChange={(e) => setGenTopic(e.target.value)}
            placeholder="Enter a topic..."
            className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-violet-500"
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.txt,.jpg,.jpeg,.png,.webp"
            onChange={(e) => {
              const selected = Array.from(e.target.files ?? []);
              const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file
              const MAX_TOTAL_SIZE = 30 * 1024 * 1024; // 30 MB total
              const currentTotal = genFiles.reduce((s, f) => s + f.size, 0);

              const valid: File[] = [];
              let runningTotal = currentTotal;
              for (const f of selected) {
                if (f.size > MAX_FILE_SIZE) {
                  toast.error(`"${f.name}" exceeds the 10 MB per-file limit (${(f.size / 1024 / 1024).toFixed(1)} MB).`);
                  continue;
                }
                if (runningTotal + f.size > MAX_TOTAL_SIZE) {
                  toast.error(`Adding "${f.name}" would exceed the 30 MB total limit.`);
                  break;
                }
                valid.push(f);
                runningTotal += f.size;
              }
              if (valid.length > 0) setGenFiles((prev) => [...prev, ...valid]);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <Upload className="h-3.5 w-3.5" /> Attach
          </button>
        </div>

        {genFiles.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {genFiles.map((f, i) => (
              <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                <FileText className="h-3.5 w-3.5" />
                {f.name}
                <span className="text-violet-400 dark:text-violet-500">({(f.size / 1024).toFixed(0)} KB)</span>
                <button
                  type="button"
                  onClick={() => setGenFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-violet-100 dark:hover:bg-violet-800/50"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <span className="text-xs text-zinc-400">
              {(genFiles.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} / 30 MB
            </span>
          </div>
        )}

        {/* Language + Level */}
        <div className="flex items-center gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-500">Language</label>
            <select
              value={genLanguage}
              onChange={(e) => setGenLanguage(e.target.value)}
              className="block rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              {EXERCISE_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-500">CEFR Level</label>
            <select
              value={genCefrLevel}
              onChange={(e) => setGenCefrLevel(e.target.value)}
              className="block rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              {CEFR_LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Exercise type rows */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Exercise Types</span>
            <span className="text-xs text-zinc-400">Count</span>
          </div>
          {templates.filter((t) => t.isActive).map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-white px-3 py-2 dark:border-zinc-700/50 dark:bg-zinc-800/50">
              <span className="text-base">{getTypeIcon(t.slug)}</span>
              <span className="flex-1 text-sm font-medium">{t.name}</span>

              {/* Edit prompt button */}
              <button
                type="button"
                onClick={() => {
                  if (editingTemplateId === t.id) {
                    setEditingTemplateId(null);
                  } else {
                    setEditingTemplateId(t.id);
                    setEditingTemplatePrompt(t.promptTemplate);
                  }
                }}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                title="Edit prompt"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>

              {/* Delete custom template */}
              {!t.isSystem && (
                <button
                  type="button"
                  onClick={() => setDeleteTemplateId(t.id)}
                  className="rounded-md p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Count stepper */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setGenCounts((p) => ({ ...p, [t.id]: Math.max(0, (p[t.id] ?? 0) - 1) }))}
                  disabled={(genCounts[t.id] ?? 0) <= 0}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-30 dark:border-zinc-700 dark:hover:bg-zinc-700"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-6 text-center text-sm font-semibold">{genCounts[t.id] ?? 0}</span>
                <button
                  type="button"
                  onClick={() => setGenCounts((p) => ({ ...p, [t.id]: Math.min(10, (p[t.id] ?? 0) + 1) }))}
                  disabled={(genCounts[t.id] ?? 0) >= 10}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-30 dark:border-zinc-700 dark:hover:bg-zinc-700"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}

          {/* Inline prompt editor */}
          {editingTemplateId && (
            <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-900/10">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-violet-700 dark:text-violet-400">
                  Edit Prompt — {templates.find((t) => t.id === editingTemplateId)?.name}
                </span>
                <span className="text-xs text-zinc-400">
                  Variables: {"{{topic}}, {{language}}, {{cefrLevel}}, {{count}}, {{#sourceContent}}...{{/sourceContent}}"}
                </span>
              </div>
              <textarea
                value={editingTemplatePrompt}
                onChange={(e) => setEditingTemplatePrompt(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-800"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveTemplatePrompt(editingTemplateId)}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500"
                >
                  Save Prompt
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTemplateId(null)}
                  className="rounded-lg px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* New exercise type creator */}
          {creatingTemplate ? (
            <div className="rounded-lg border border-dashed border-violet-300 bg-violet-50/30 p-3 dark:border-violet-700 dark:bg-violet-900/10">
              <div className="space-y-2">
                <input
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Exercise type name..."
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
                <select
                  value={newTemplateSkill}
                  onChange={(e) => setNewTemplateSkill(e.target.value)}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                >
                  <option value="vocabulary">Vocabulary</option>
                  <option value="grammar">Grammar</option>
                  <option value="reading">Reading</option>
                  <option value="writing">Writing</option>
                  <option value="listening">Listening</option>
                </select>
                <textarea
                  value={newTemplatePrompt}
                  onChange={(e) => setNewTemplatePrompt(e.target.value)}
                  placeholder={"AI prompt template...\nUse {{topic}}, {{language}}, {{cefrLevel}}, {{count}}"}
                  rows={4}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-800"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCreateTemplate}
                    disabled={!newTemplateName.trim() || !newTemplatePrompt.trim()}
                    className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatingTemplate(false)}
                    className="rounded-lg px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreatingTemplate(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 py-2 text-xs font-medium text-zinc-500 transition hover:border-violet-400 hover:text-violet-600 dark:border-zinc-600 dark:hover:border-violet-500 dark:hover:text-violet-400"
            >
              <Plus className="h-3.5 w-3.5" /> New Exercise Type
            </button>
          )}
        </div>

        {/* Generate button */}
        <div className="flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-700/50">
          <span className="text-sm text-zinc-500">
            Total: <span className="font-semibold">{totalGenCount}</span> exercise{totalGenCount !== 1 ? "s" : ""}
          </span>
          <button
            type="submit"
            disabled={generating || !genTopic.trim() || totalGenCount === 0}
            className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate"}
          </button>
        </div>
      </form>

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
            <option key={t} value={t}>{getTypeLabel(t, templates)}</option>
          ))}
        </select>
        <select
          value={filterCefrLevel}
          onChange={(e) => setFilterCefrLevel(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="all">All levels</option>
          {CEFR_LEVELS.map((l) => (
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
                              {getTypeLabel(ex.type, templates)}
                            </span>
                          </div>
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
                            onClick={() => handleRegenerate(ex.id)}
                            disabled={regeneratingIds.has(ex.id)}
                            className="rounded-md p-1.5 text-zinc-400 hover:bg-violet-50 hover:text-violet-500 disabled:opacity-50 dark:hover:bg-violet-900/20"
                            title="Regenerate"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${regeneratingIds.has(ex.id) ? "animate-spin" : ""}`} />
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
                          <ExercisePreview exercise={ex} />
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
              Generate exercises using the form above
            </p>
          </div>
        )}
      </div>

      <AlertDialog
        open={deleteTemplateId !== null}
        onOpenChange={(open) => { if (!open) setDeleteTemplateId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exercise Type</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this custom exercise type. Existing
              exercises using it will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTemplateId) handleDeleteTemplate(deleteTemplateId);
                setDeleteTemplateId(null);
              }}
              className="bg-red-600 text-white hover:bg-red-500"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
