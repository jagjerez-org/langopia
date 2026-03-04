"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BookOpen,
  ArrowLeft,
  Sparkles,
  Trash2,
  Check,
  X,
  Eye,
  RefreshCw,
  Pencil,
  Save,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { ExerciseWizard } from "@/components/exercise-wizard";
import { RegenerateDialog } from "@/components/regenerate-dialog";
import { ExerciseRenderer } from "@/components/exercises/exercise-renderer";
import { EXERCISE_TYPE_CONFIG, ExerciseType } from "@langopia/shared/types";
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
  sortOrder?: number;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  ready: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  completed: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

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

  // Exercise generation wizard
  const [wizardOpen, setWizardOpen] = useState(false);

  // Per-exercise state
  const [previewingIds, setPreviewingIds] = useState<Set<string>>(new Set());
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [editDrafts, setEditDrafts] = useState<Record<string, Partial<Exercise>>>({});
  const [savingEdits, setSavingEdits] = useState<Set<string>>(new Set());
  const [regenerateExercise, setRegenerateExercise] = useState<Exercise | null>(null);

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

  useEffect(() => {
    if (selectedAcademy) {
      loadLesson();
      loadExercises();
    }
  }, [selectedAcademy, loadLesson, loadExercises]);

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

  function handleRegenerateClick(exercise: Exercise) {
    setRegenerateExercise(exercise);
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
      <div className="glass flex items-center justify-between rounded-xl p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <h3 className="font-semibold">Generate Exercises</h3>
          <span className="text-sm text-zinc-500">Upload material and let AI suggest exercises</span>
        </div>
        <button
          onClick={() => setWizardOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:shadow-lg"
        >
          <Sparkles className="h-4 w-4" />
          Generate
        </button>
      </div>

      {/* Exercise Wizard */}
      {apiKey && lesson && (
        <ExerciseWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          apiKey={apiKey}
          lessonId={id}
          lessonTitle={lesson.title}
          lessonLanguage={lesson.language}
          lessonCefrLevel={lesson.cefrLevel}
          onComplete={() => {
            loadExercises();
            loadLesson();
          }}
        />
      )}

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
                      <span className="text-zinc-500">{getTypeIcon(ex.type)}</span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {getTypeLabel(ex.type)}
                      </span>
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                        {ex.targetSkill}
                      </span>
                    </div>
                    {ex.title && (
                      <p className="text-sm font-semibold">{ex.title}</p>
                    )}
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
                      onClick={() => handleRegenerateClick(ex)}
                      className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                      title="Regenerate"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleteExerciseId(ex.id)} className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20" title="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Preview */}
                {previewingIds.has(ex.id) && (
                  <div className="border-t border-zinc-100 p-5 dark:border-zinc-800">
                    <ExerciseRenderer exercise={ex} mode="interactive" />
                  </div>
                )}

                {/* Inline edit */}
                {editingIds.has(ex.id) && (
                  <div className="space-y-3 border-t border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/30">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-zinc-500">Title</label>
                      <input
                        value={editDrafts[ex.id]?.title ?? ex.title ?? ""}
                        onChange={(e) => setEditDrafts((prev) => ({ ...prev, [ex.id]: { ...prev[ex.id], title: e.target.value } }))}
                        placeholder="Exercise title (optional)"
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </div>
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
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-500">Video URL</label>
                        <input
                          value={editDrafts[ex.id]?.videoUrl ?? ex.videoUrl ?? ""}
                          onChange={(e) => setEditDrafts((prev) => ({ ...prev, [ex.id]: { ...prev[ex.id], videoUrl: e.target.value || null } }))}
                          placeholder="https://..."
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-500">Image URL</label>
                        <input
                          value={editDrafts[ex.id]?.imageUrl ?? ex.imageUrl ?? ""}
                          onChange={(e) => setEditDrafts((prev) => ({ ...prev, [ex.id]: { ...prev[ex.id], imageUrl: e.target.value || null } }))}
                          placeholder="https://..."
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

      {/* Regenerate dialog */}
      {regenerateExercise && apiKey && (
        <RegenerateDialog
          exerciseId={regenerateExercise.id}
          exerciseType={regenerateExercise.type}
          exerciseTargetSkill={regenerateExercise.targetSkill}
          exerciseInstruction={regenerateExercise.instruction}
          apiKey={apiKey}
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
