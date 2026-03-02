"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  BookOpen,
  ArrowLeft,
  Sparkles,
  Trash2,
  Check,
  X,
  Eye,
  EyeOff,
  Lightbulb,
  RefreshCw,
  Volume2,
  Pause,
  Play,
  Upload,
  FileText,
  Pencil,
  Plus,
  Minus,
  Save,
  Settings2,
} from "lucide-react";
import { CEFR_LEVELS } from "@langopia/shared/types";
import { toast } from "sonner";
import { useAcademy } from "@/components/academy-provider";
import { useParams, useRouter } from "next/navigation";
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
  sortOrder?: number;
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

const statusColors: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  ready: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  completed: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

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

// ─── Audio Player ──────────────────────────────────────
function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  function toggle() {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); } else { audioRef.current.play(); }
    setPlaying(!playing);
  }

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onEnd = () => setPlaying(false);
    a.addEventListener("ended", onEnd);
    return () => a.removeEventListener("ended", onEnd);
  }, []);

  return (
    <div className="flex items-center gap-3 rounded-xl bg-violet-50 p-3 dark:bg-violet-900/20">
      <button onClick={toggle} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white transition hover:bg-violet-400">
        {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
      </button>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-zinc-400" />
          <span className="text-xs font-medium text-zinc-500">{playing ? "Playing audio..." : "Click to play"}</span>
        </div>
      </div>
      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  );
}

// ─── Exercise Content Preview ──────────────────────────
function ExercisePreview({ exercise }: { exercise: Exercise }) {
  const [showAnswer, setShowAnswer] = useState(false);

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{exercise.instruction}</div>
      {exercise.audioUrl && <AudioPlayer src={exercise.audioUrl} />}

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
                  isCorrectOpt ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
                }`}>
                  {isCorrectOpt ? <Check className="h-3.5 w-3.5" /> : letter}
                </span>
                <span className="text-sm">{opt}</span>
              </div>
            );
          })}
        </div>
      )}

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

// ─── Main Page ──────────────────────────────────────────
export default function LessonDetailPage() {
  const { selectedAcademy, selectedAcademyData, loading: academyLoading } = useAcademy();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loadingLesson, setLoadingLesson] = useState(true);

  // Lesson editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  // Exercise generation
  const [templates, setTemplates] = useState<ExerciseTemplateData[]>([]);
  const [genTopic, setGenTopic] = useState("");
  const [genCounts, setGenCounts] = useState<Record<string, number>>({});
  const [genFiles, setGenFiles] = useState<File[]>([]);
  const [generating, setGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Per-exercise state
  const [previewingIds, setPreviewingIds] = useState<Set<string>>(new Set());
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [editDrafts, setEditDrafts] = useState<Record<string, Partial<Exercise>>>({});
  const [savingEdits, setSavingEdits] = useState<Set<string>>(new Set());
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());

  // Delete confirmation
  const [deleteExerciseId, setDeleteExerciseId] = useState<string | null>(null);
  const [deleteLessonOpen, setDeleteLessonOpen] = useState(false);

  const apiKey = selectedAcademyData?.apiKey;

  const loadLesson = useCallback(async () => {
    if (!apiKey || !id) return;
    setLoadingLesson(true);
    try {
      const res = await fetch(`/api/v1/lessons/${id}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        setLesson(await res.json());
      } else {
        toast.error("Lesson not found");
        router.push("/dashboard/lessons");
      }
    } finally {
      setLoadingLesson(false);
    }
  }, [apiKey, id, router]);

  const loadExercises = useCallback(async () => {
    if (!apiKey || !id) return;
    const res = await fetch(`/api/v1/lessons/${id}/exercises`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const data = await res.json();
      setExercises(data.data ?? []);
    }
  }, [apiKey, id]);

  const loadTemplates = useCallback(async () => {
    if (!apiKey) return;
    const res = await fetch("/api/v1/exercises/templates", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const data = await res.json();
      const tpls = data.data ?? [];
      setTemplates(tpls);
      setGenCounts((prev) => {
        const next: Record<string, number> = {};
        for (const t of tpls) next[t.id] = prev[t.id] ?? 0;
        return next;
      });
    }
  }, [apiKey]);

  useEffect(() => {
    if (selectedAcademy) {
      loadLesson();
      loadExercises();
      loadTemplates();
    }
  }, [selectedAcademy, loadLesson, loadExercises, loadTemplates]);

  const totalGenCount = Object.values(genCounts).reduce((s, c) => s + c, 0);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (totalGenCount === 0 || !apiKey) return;

    setGenerating(true);
    try {
      const templateRequests = Object.entries(genCounts)
        .filter(([, count]) => count > 0)
        .map(([templateId, count]) => ({ templateId, count }));

      let res: Response;
      if (genFiles.length > 0) {
        const formData = new FormData();
        if (genTopic) formData.append("topic", genTopic);
        formData.append("templates", JSON.stringify(templateRequests));
        for (const f of genFiles) formData.append("file", f);
        res = await fetch(`/api/v1/lessons/${id}/exercises`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: formData,
        });
      } else {
        res = await fetch(`/api/v1/lessons/${id}/exercises`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            topic: genTopic || undefined,
            templates: templateRequests,
          }),
        });
      }

      if (res.status === 403) {
        const data = await res.json();
        toast.error(data.error || "AI token limit exceeded.");
        return;
      }

      if (res.ok) {
        const data = await res.json();
        toast.success(`Generated ${data.generated?.length ?? 0} exercises`);
        setGenTopic("");
        setGenFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setGenCounts((prev) => {
          const next: Record<string, number> = {};
          for (const k of Object.keys(prev)) next[k] = 0;
          return next;
        });
        loadExercises();
        loadLesson();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to generate exercises");
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleUnlinkExercise(exerciseId: string) {
    if (!apiKey) return;
    const res = await fetch(`/api/v1/lessons/${id}/exercises?exerciseId=${exerciseId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      setExercises((prev) => prev.filter((e) => e.id !== exerciseId));
      setDeleteExerciseId(null);
      toast.success("Exercise removed from lesson");
      loadLesson();
    }
  }

  async function handleDeleteLesson() {
    if (!apiKey) return;
    const res = await fetch(`/api/v1/lessons/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      toast.success("Lesson deleted");
      router.push("/dashboard/lessons");
    }
  }

  async function handleUpdateTitle() {
    if (!apiKey || !titleDraft.trim()) return;
    const res = await fetch(`/api/v1/lessons/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleDraft }),
    });
    if (res.ok) {
      setLesson((prev) => prev ? { ...prev, title: titleDraft } : prev);
      setEditingTitle(false);
    }
  }

  async function handleUpdateStatus(status: string) {
    if (!apiKey) return;
    const res = await fetch(`/api/v1/lessons/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setLesson((prev) => prev ? { ...prev, status } : prev);
    }
  }

  async function handleRegenerate(exerciseId: string) {
    if (!apiKey) return;
    setRegeneratingIds((prev) => new Set(prev).add(exerciseId));
    try {
      const res = await fetch(`/api/v1/exercises/${exerciseId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const newExercise = await res.json();
        setExercises((prev) => prev.map((ex) => (ex.id === exerciseId ? { ...ex, ...newExercise } : ex)));
      }
    } finally {
      setRegeneratingIds((prev) => { const next = new Set(prev); next.delete(exerciseId); return next; });
    }
  }

  async function handleSaveEdit(exerciseId: string) {
    if (!apiKey) return;
    const draft = editDrafts[exerciseId];
    if (!draft) return;
    setSavingEdits((prev) => new Set(prev).add(exerciseId));
    try {
      const res = await fetch(`/api/v1/exercises/${exerciseId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        const updated = await res.json();
        setExercises((prev) => prev.map((ex) => (ex.id === exerciseId ? { ...ex, ...updated } : ex)));
        setEditingIds((prev) => { const next = new Set(prev); next.delete(exerciseId); return next; });
        setEditDrafts((prev) => { const next = { ...prev }; delete next[exerciseId]; return next; });
      }
    } finally {
      setSavingEdits((prev) => { const next = new Set(prev); next.delete(exerciseId); return next; });
    }
  }

  function togglePreview(exerciseId: string) {
    setPreviewingIds((prev) => { const next = new Set(prev); if (next.has(exerciseId)) next.delete(exerciseId); else next.add(exerciseId); return next; });
  }

  function toggleEdit(exerciseId: string) {
    setEditingIds((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) {
        next.delete(exerciseId);
        setEditDrafts((d) => { const n = { ...d }; delete n[exerciseId]; return n; });
      } else {
        next.add(exerciseId);
        setEditDrafts((d) => ({ ...d, [exerciseId]: {} }));
      }
      return next;
    });
  }

  if (academyLoading || loadingLesson) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="glass h-40 animate-pulse rounded-xl" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass h-24 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!lesson) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => router.push("/dashboard/lessons")}
          className="mb-3 flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Lessons
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleUpdateTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                  className="w-full rounded-lg border border-violet-400 bg-white px-3 py-1.5 text-xl font-bold outline-none dark:border-violet-600 dark:bg-zinc-800"
                  autoFocus
                />
                <button onClick={handleUpdateTitle} className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={() => setEditingTitle(false)} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <h1
                className="cursor-pointer text-2xl font-bold hover:text-violet-600 dark:hover:text-violet-400"
                onClick={() => { setTitleDraft(lesson.title); setEditingTitle(true); }}
                title="Click to edit"
              >
                {lesson.title}
              </h1>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                {lesson.language.toUpperCase()}
              </span>
              <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                {lesson.cefrLevel}
              </span>
              <span>{lesson.exerciseCount} exercise{lesson.exerciseCount !== 1 ? "s" : ""}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={lesson.status}
              onChange={(e) => handleUpdateStatus(e.target.value)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize ${statusColors[lesson.status] ?? "border-zinc-200"}`}
            >
              <option value="draft">Draft</option>
              <option value="ready">Ready</option>
              <option value="completed">Completed</option>
            </select>
            <button
              onClick={() => setDeleteLessonOpen(true)}
              className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
              title="Delete lesson"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        {lesson.description && (
          <p className="mt-2 text-sm text-zinc-500">{lesson.description}</p>
        )}
      </div>

      {/* Exercise Generator */}
      <form onSubmit={handleGenerate} className="glass space-y-4 rounded-xl p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <h3 className="font-semibold">Generate Exercises</h3>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-500">
            Topic override <span className="text-zinc-400">(defaults to lesson title: {lesson.title})</span>
          </label>
          <input
            value={genTopic}
            onChange={(e) => setGenTopic(e.target.value)}
            placeholder={lesson.title || "Enter a topic..."}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-violet-500"
          />
        </div>

        {/* File upload */}
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
            <Upload className="h-3.5 w-3.5" /> Attach files
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.md,.pptx,.csv"
              className="hidden"
              onChange={(e) => setGenFiles(Array.from(e.target.files ?? []))}
            />
          </label>
          {genFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {genFiles.map((f, i) => (
                <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-xs text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                  <FileText className="h-3 w-3" /> {f.name}
                  <button type="button" onClick={() => setGenFiles((prev) => prev.filter((_, j) => j !== i))} className="ml-0.5 hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Template selectors */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-500">Exercise types &amp; counts</label>
          {templates.filter((t) => t.isActive).map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50/50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/30">
              <div className="flex items-center gap-2">
                <span className="text-sm">{getTypeIcon(t.slug)}</span>
                <span className="text-sm font-medium">{t.name}</span>
                {t.targetSkill && <span className="rounded-md bg-zinc-200/50 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-700/50">{t.targetSkill}</span>}
              </div>
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
        </div>

        <button
          type="submit"
          disabled={generating || totalGenCount === 0}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {generating ? "Generating..." : `Generate ${totalGenCount} Exercise${totalGenCount !== 1 ? "s" : ""}`}
        </button>
      </form>

      {/* Exercise List */}
      <div>
        <h3 className="mb-3 text-lg font-semibold">Exercises ({exercises.length})</h3>
        {exercises.length === 0 ? (
          <div className="glass flex flex-col items-center justify-center rounded-xl py-12 text-center">
            <BookOpen className="mb-3 h-8 w-8 text-zinc-400" />
            <p className="font-medium text-zinc-500">No exercises yet</p>
            <p className="mt-1 text-sm text-zinc-400">Use the generator above to create exercises for this lesson</p>
          </div>
        ) : (
          <div className="space-y-3">
            {exercises.map((ex) => (
              <div key={ex.id} className="overflow-hidden rounded-xl border border-zinc-200/60 bg-white shadow-sm dark:border-zinc-700/60 dark:bg-zinc-900">
                {/* Exercise card header */}
                <div className="flex items-center gap-3 p-4">
                  <div className="flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-sm">{getTypeIcon(ex.type)}</span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {getTypeLabel(ex.type, templates)}
                      </span>
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                        {ex.targetSkill}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{ex.instruction}</p>
                    <p className="mt-0.5 text-sm text-zinc-500 line-clamp-1">{ex.content}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => togglePreview(ex.id)}
                      className={`rounded-md p-1.5 transition ${
                        previewingIds.has(ex.id)
                          ? "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
                          : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                      }`}
                      title="Preview"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button onClick={() => toggleEdit(ex.id)} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleRegenerate(ex.id)}
                      disabled={regeneratingIds.has(ex.id)}
                      className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 disabled:opacity-50"
                      title="Regenerate"
                    >
                      <RefreshCw className={`h-4 w-4 ${regeneratingIds.has(ex.id) ? "animate-spin" : ""}`} />
                    </button>
                    <button onClick={() => setDeleteExerciseId(ex.id)} className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20" title="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Preview */}
                {previewingIds.has(ex.id) && (
                  <div className="border-t border-zinc-100 p-5 dark:border-zinc-800">
                    <ExercisePreview exercise={ex} />
                  </div>
                )}

                {/* Inline edit */}
                {editingIds.has(ex.id) && (
                  <div className="space-y-3 border-t border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/30">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-zinc-500">Instruction</label>
                      <input
                        value={editDrafts[ex.id]?.instruction ?? ex.instruction}
                        onChange={(e) => setEditDrafts((prev) => ({ ...prev, [ex.id]: { ...prev[ex.id], instruction: e.target.value } }))}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-zinc-500">Content</label>
                      <textarea
                        value={editDrafts[ex.id]?.content ?? ex.content}
                        onChange={(e) => setEditDrafts((prev) => ({ ...prev, [ex.id]: { ...prev[ex.id], content: e.target.value } }))}
                        rows={2}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-500">Correct Answer</label>
                        <input
                          value={editDrafts[ex.id]?.correctAnswer ?? ex.correctAnswer ?? ""}
                          onChange={(e) => setEditDrafts((prev) => ({ ...prev, [ex.id]: { ...prev[ex.id], correctAnswer: e.target.value } }))}
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-500">Explanation</label>
                        <input
                          value={editDrafts[ex.id]?.explanation ?? ex.explanation ?? ""}
                          onChange={(e) => setEditDrafts((prev) => ({ ...prev, [ex.id]: { ...prev[ex.id], explanation: e.target.value } }))}
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSaveEdit(ex.id)}
                        disabled={savingEdits.has(ex.id)}
                        className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                      >
                        <Save className="h-3.5 w-3.5" /> {savingEdits.has(ex.id) ? "Saving..." : "Save"}
                      </button>
                      <button onClick={() => toggleEdit(ex.id)} className="rounded-lg px-4 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete exercise confirmation */}
      <AlertDialog open={!!deleteExerciseId} onOpenChange={() => setDeleteExerciseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Exercise</AlertDialogTitle>
            <AlertDialogDescription>
              This will unlink the exercise from this lesson. The exercise will remain in the exercise bank.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteExerciseId && handleUnlinkExercise(deleteExerciseId)} className="bg-red-600 text-white hover:bg-red-500">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete lesson confirmation */}
      <AlertDialog open={deleteLessonOpen} onOpenChange={setDeleteLessonOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lesson</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the lesson and unlink all its exercises. The exercises will remain in the exercise bank.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLesson} className="bg-red-600 text-white hover:bg-red-500">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
