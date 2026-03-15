"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  X,
  Check,
  ChevronRight,
  ChevronDown,
  Loader2,
  Lightbulb,
  Library,
  Eye,
  Pencil,
  RefreshCw,
  Save,
  Volume2,
  Video,
  Image as ImageIcon,
  Trash2,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import {
  EXERCISE_LANGUAGES,
  ExerciseType,
  EXERCISE_TYPE_CONFIG,
  LessonStatus,
} from "@langopia/shared/types";
import { ApiError } from "@langopia/api-client";
import type { PreviewExercise } from "@langopia/api-client";
import { toast } from "sonner";
import { useApiKeyClient } from "@/hooks/use-api-client";
import { useAcademyLevels } from "@/hooks/use-academy-levels";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MediaLibrarySidebar, type MediaSelection } from "@/components/media-library-sidebar";
import { ExerciseRenderer } from "@/components/exercises/exercise-renderer";
import { LessonPlanChat } from "@/components/lesson-plan-chat";

// ─── Types ──────────────────────────────────────────────

interface LessonWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingLesson?: {
    id: string;
    title: string;
    description: string | null;
    language: string;
    cefrLevel: string;
    status: string;
  };
  editingExercises?: Exercise[];
  onComplete?: () => void;
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
  needsAudio?: boolean;
  sortOrder?: number;
  createdAt: string;
}

interface ExistingExercise {
  id: string;
  type: string;
  title?: string | null;
  targetSkill: string;
  instruction: string;
  content: string;
  similarity: "very_high" | "high" | "medium";
}

interface AnalysisMetadata {
  detectedTopic: string;
  detectedLanguage: string;
  detectedCefrLevel: string;
  suggestedTitle: string;
  suggestedDescription: string;
  materialSummary: string;
}

// ─── Helpers ────────────────────────────────────────────

function getTypeIcon(type: string) {
  const config = EXERCISE_TYPE_CONFIG[type as ExerciseType];
  if (!config) return <Sparkles className="h-4 w-4" />;
  const IconComp = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[config.icon];
  return IconComp ? <IconComp className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />;
}

function getTypeLabel(type: string): string {
  const config = EXERCISE_TYPE_CONFIG[type as ExerciseType];
  return config?.label ?? type.replace(/_/g, " ");
}

function previewToExercise(p: PreviewExercise, language: string, topic: string): Exercise {
  return {
    id: p.tempId,
    type: p.type,
    targetSkill: p.targetSkill,
    topic,
    language,
    title: p.title,
    instruction: p.instruction,
    content: p.content,
    options: p.options ?? null,
    correctAnswer: p.correctAnswer,
    explanation: p.explanation,
    cefrLevel: p.cefrLevel,
    needsAudio: p.needsAudio,
    source: "ai_live",
    createdAt: new Date().toISOString(),
  };
}

// ─── Step Indicator ──────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  const steps = ["Material", "Review Exercises", "Confirm"];
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-300 ${
                i < current
                  ? "bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
                  : i === current
                  ? "bg-violet-600 text-white shadow-md shadow-violet-500/25"
                  : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
              }`}
            >
              {i < current ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span
              className={`text-xs font-medium transition-colors ${
                i < current
                  ? "text-emerald-600 dark:text-emerald-400"
                  : i === current
                  ? "text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-400 dark:text-zinc-500"
              }`}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px w-6 transition-colors ${i < current ? "bg-emerald-400/40" : "bg-zinc-200 dark:bg-zinc-700"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Wizard ─────────────────────────────────────────

export function LessonWizard({
  open,
  onOpenChange,
  editingLesson,
  editingExercises,
  onComplete,
}: LessonWizardProps) {
  const api = useApiKeyClient();
  const { levelCodes } = useAcademyLevels();

  // ─── Step state ─────────────
  const [step, setStep] = useState(0);

  // Lesson info (deduced by AI, editable by user in Step 1)
  const [title, setTitle] = useState(editingLesson?.title ?? "");
  const [description, setDescription] = useState(editingLesson?.description ?? "");
  const [language, setLanguage] = useState(editingLesson?.language ?? "");
  const [cefrLevel, setCefrLevel] = useState(editingLesson?.cefrLevel ?? "");
  const [lessonId, setLessonId] = useState<string | null>(editingLesson?.id ?? null);

  // Step 0: Material source
  const [materialText, setMaterialText] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<MediaSelection[]>([]);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const exercisesSectionRef = useRef<HTMLDivElement>(null);

  // Step 1: Analysis metadata + exercises
  const [analysisMetadata, setAnalysisMetadata] = useState<AnalysisMetadata | null>(null);
  const [existingExercises, setExistingExercises] = useState<ExistingExercise[]>([]);

  // Step 1: Exercise preview (local state, no DB)
  const [generatedExercises, setGeneratedExercises] = useState<Exercise[]>(editingExercises ?? []);
  const [selectedGenerated, setSelectedGenerated] = useState<Set<string>>(
    new Set(editingExercises?.map((e) => e.id) ?? [])
  );
  const [previewingIds, setPreviewingIds] = useState<Set<string>>(new Set());
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [editDrafts, setEditDrafts] = useState<Record<string, Partial<Exercise>>>({});

  // Collapsible sections in Step 1
  const [lessonInfoOpen, setLessonInfoOpen] = useState(true);

  // Step 2: Confirm
  const [saving, setSaving] = useState(false);

  // Auto-scroll to exercises when they appear
  useEffect(() => {
    if (generatedExercises.length > 0 && exercisesSectionRef.current) {
      setTimeout(() => {
        exercisesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [generatedExercises.length]);

  // ─── Handlers ─────────────

  function handleClose() {
    onOpenChange(false);
  }

  // Step 0: File handling
  function handleMediaSelect(selections: MediaSelection[]) {
    setSelectedMedia(selections);
    setMediaOpen(false);
  }

  // Step 0: Analyze & Generate — calls preview endpoint
  async function handleAnalyze() {
    if (!materialText.trim() && selectedMedia.length === 0) {
      toast.error("Provide a topic or select media from the library");
      return;
    }

    setAnalyzing(true);
    try {
      const data = await api.exercises.preview(null, {
        topic: materialText.trim() || undefined,
        language: language || undefined,
        cefrLevel: cefrLevel || undefined,
        materialContext: materialText.trim() || undefined,
        mediaItemIds: selectedMedia.length > 0 ? selectedMedia.map((m) => m.mediaItemId) : undefined,
      });

      // Set analysis metadata
      setAnalysisMetadata({
        detectedTopic: data.detectedTopic,
        detectedLanguage: data.detectedLanguage,
        detectedCefrLevel: data.detectedCefrLevel,
        suggestedTitle: data.suggestedTitle,
        suggestedDescription: data.suggestedDescription,
        materialSummary: data.materialSummary,
      });

      // AI-deduced lesson info — populate fields (user can override in Step 1)
      if (!editingLesson) {
        setTitle(data.detectedTopic || data.suggestedTitle || "");
        setDescription(data.suggestedDescription || data.materialSummary || "");
        setLanguage(data.detectedLanguage || "en");
        setCefrLevel(data.detectedCefrLevel || "B1");
      }

      if (data.existingExercises && data.existingExercises.length > 0) {
        setExistingExercises(data.existingExercises as unknown as ExistingExercise[]);
      }

      // Populate generated exercises from preview
      const effectiveLanguage = data.detectedLanguage || language || "en";
      const effectiveTopic = data.detectedTopic || materialText.trim() || "";
      const exercises = (data.exercises ?? []).map((p) =>
        previewToExercise(p, effectiveLanguage, effectiveTopic)
      );
      setGeneratedExercises(exercises);
      setSelectedGenerated(new Set(exercises.map((e) => e.id)));
      setPreviewingIds(new Set(exercises.map((e) => e.id)));
      setLessonInfoOpen(false);

      setStep(1);
    } catch (err) {
      if (err instanceof ApiError && err.isForbidden) {
        toast.error(err.message || "AI token limit exceeded.");
      } else {
        toast.error("Failed to analyze and generate exercises");
      }
    } finally {
      setAnalyzing(false);
    }
  }

  // Step 1: Refine exercises via chat
  async function handleRefineExercises(message: string, signal?: AbortSignal): Promise<string> {
    if (generatedExercises.length === 0) return "No exercises to refine.";

    const currentExercises = generatedExercises.map((ex) => ({
      tempId: ex.id,
      type: ex.type,
      title: ex.title || undefined,
      instruction: ex.instruction,
      content: ex.content,
      options: ex.options ?? undefined,
      correctAnswer: ex.correctAnswer || "",
      explanation: ex.explanation || "",
      cefrLevel: ex.cefrLevel,
      targetSkill: ex.targetSkill,
    }));

    const data = await api.exercises.refinePreview({
      currentExercises,
      userMessage: message,
      language,
      cefrLevel: cefrLevel || undefined,
      materialContext: materialText.trim() || undefined,
      topic: analysisMetadata?.detectedTopic,
    }, signal);

    // Update exercises from AI response
    const effectiveLanguage = language || "en";
    const effectiveTopic = analysisMetadata?.detectedTopic || materialText.trim() || "";
    const updatedExercises = (data.exercises ?? []).map((p) =>
      previewToExercise(p, effectiveLanguage, effectiveTopic)
    );
    setGeneratedExercises(updatedExercises);
    setSelectedGenerated(new Set(updatedExercises.map((e) => e.id)));
    setPreviewingIds(new Set(updatedExercises.map((e) => e.id)));

    return data.aiResponse;
  }

  // Step 1: Edit exercises (local-only)
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
        setEditDrafts((d) => { const n = { ...d }; delete n[id]; return n; });
      } else {
        next.add(id);
        setEditDrafts((d) => ({ ...d, [id]: {} }));
      }
      return next;
    });
  }

  function handleSaveEdit(exerciseId: string) {
    const draft = editDrafts[exerciseId];
    if (!draft) return;
    // Apply draft changes to local state only — no API call
    setGeneratedExercises((prev) =>
      prev.map((ex) => (ex.id === exerciseId ? { ...ex, ...draft } : ex))
    );
    setEditingIds((prev) => { const next = new Set(prev); next.delete(exerciseId); return next; });
    setEditDrafts((prev) => { const next = { ...prev }; delete next[exerciseId]; return next; });
  }

  function toggleSelect(id: string) {
    setSelectedGenerated((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDeleteExercise(id: string) {
    // Local-only delete — no API call
    setGeneratedExercises((prev) => prev.filter((e) => e.id !== id));
    setSelectedGenerated((prev) => { const next = new Set(prev); next.delete(id); return next; });
    setPreviewingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    setEditingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    setEditDrafts((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }

  // Step 2: Save — creates lesson + bulk saves exercises
  async function handleSave(status: "draft" | "ready") {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    const selectedExercises = generatedExercises.filter((e) => selectedGenerated.has(e.id));
    if (selectedExercises.length === 0) {
      toast.error("Select at least one exercise");
      return;
    }

    setSaving(true);
    try {
      // Create or update lesson
      let currentLessonId = lessonId;
      if (!currentLessonId) {
        const lesson = await api.lessons.create({
          title: title.trim(),
          language,
          cefrLevel: cefrLevel || "B1",
          description: description.trim() || undefined,
        });
        currentLessonId = lesson.id;
        setLessonId(currentLessonId);
      } else if (editingLesson) {
        await api.lessons.update(currentLessonId, {
          title: title.trim(),
          description: description.trim() || undefined,
          status: editingLesson.status as LessonStatus,
        });
      }

      // Bulk save selected exercises
      await api.exercises.bulkSave({
        lessonId: currentLessonId || undefined,
        topic: analysisMetadata?.detectedTopic || materialText.trim() || title,
        exercises: selectedExercises.map((ex) => ({
          type: ex.type,
          title: ex.title || undefined,
          targetSkill: ex.targetSkill,
          instruction: ex.instruction,
          content: ex.content,
          options: ex.options ?? undefined,
          correctAnswer: ex.correctAnswer || "",
          explanation: ex.explanation || "",
          cefrLevel: ex.cefrLevel,
          language: ex.language || language || "en",
          needsAudio: ex.needsAudio,
        })),
      });

      // Update lesson status
      if (currentLessonId) {
        await api.lessons.update(currentLessonId, { status: status as LessonStatus });
        // Create version snapshot
        try {
          await api.lessons.createVersion(currentLessonId);
        } catch {
          // non-fatal — snapshot is optional
        }
      }

      toast.success(`Saved ${selectedExercises.length} exercise${selectedExercises.length !== 1 ? "s" : ""} (${status})`);
      onComplete?.();
      handleClose();
    } catch {
      toast.error("Failed to save lesson");
    } finally {
      setSaving(false);
    }
  }

  // ─── Computed ─────────────
  const effectiveLevels = levelCodes.length > 0 ? levelCodes : ["A1", "A2", "B1", "B2", "C1", "C2"];

  // ─── Render ────────────────
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-6xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0 border-zinc-200/80 shadow-xl shadow-black/5 dark:border-zinc-700/80 dark:shadow-black/30">
          {/* ─── Header ─── */}
          <div className="shrink-0 flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
            <DialogHeader className="p-0 gap-0">
              <DialogTitle className="flex items-center gap-2.5 text-base font-semibold tracking-tight">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm shadow-violet-500/20">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                {editingLesson ? "Edit Lesson" : "Create Lesson"}
              </DialogTitle>
            </DialogHeader>
            <StepIndicator current={step} />
          </div>

          {/* ─── Body ─── */}
          <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5">

          {/* ═══ STEP 0: Material Source ═══ */}
          {step === 0 && (
            <div className="mx-auto max-w-2xl space-y-5">
              <div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Describe your topic and optionally select materials from the media library.
                </p>
              </div>

              {/* Prompt */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-500">Topic / Context</label>
                <textarea
                  value={materialText}
                  onChange={(e) => setMaterialText(e.target.value)}
                  placeholder="Describe the topic, paste text, or provide context for exercise generation..."
                  rows={4}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-violet-500"
                />
              </div>

              {/* Media Library */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-500">Materials from Media Library (optional)</label>
                {selectedMedia.length > 0 && (
                  <div className="space-y-1">
                    {selectedMedia.map((m, i) => (
                      <div key={`${m.mediaItemId}-${i}`} className="flex items-center justify-between rounded-lg bg-violet-50 px-3 py-2 text-sm dark:bg-violet-900/10">
                        <span className="truncate font-medium text-violet-700 dark:text-violet-400">{m.filename}</span>
                        <button
                          onClick={() => setSelectedMedia((prev) => prev.filter((s) => s.mediaItemId !== m.mediaItemId))}
                          className="text-zinc-400 hover:text-red-500"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={() => setMediaOpen(true)}
                  className="w-full"
                >
                  <Library className="mr-2 h-4 w-4" />
                  {selectedMedia.length > 0 ? "Change Selection" : "Browse Media Library"}
                </Button>
              </div>
            </div>
          )}

          {/* ═══ STEP 1: Review Exercises ═══ */}
          {step === 1 && (
            <div className="flex flex-col gap-5 lg:flex-row">
              {/* ── Left column ── */}
              <div className="flex-1 min-w-0 space-y-4">
                {/* Collapsible: AI-deduced Lesson Info */}
                <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white dark:border-zinc-700/80 dark:bg-zinc-900">
                  <button
                    onClick={() => setLessonInfoOpen(!lessonInfoOpen)}
                    className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-100 dark:bg-violet-900/30">
                        <Sparkles className="h-3 w-3 text-violet-600 dark:text-violet-400" />
                      </div>
                      <h4 className="text-sm font-medium">Lesson Info</h4>
                      {!lessonInfoOpen && title && (
                        <span className="ml-1 max-w-48 truncate text-xs text-zinc-400">{title}</span>
                      )}
                    </div>
                    <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${lessonInfoOpen ? "rotate-180" : ""}`} />
                  </button>
                  {lessonInfoOpen && (
                    <div className="border-t border-zinc-100 px-4 py-3.5 space-y-3 dark:border-zinc-800">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-zinc-500">Title *</label>
                        <input
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Lesson title"
                          className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-sm outline-none transition focus:border-violet-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800/50 dark:focus:border-violet-500 dark:focus:bg-zinc-800"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-zinc-500">Description</label>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Lesson description..."
                          rows={2}
                          className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-sm outline-none transition focus:border-violet-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800/50 dark:focus:border-violet-500 dark:focus:bg-zinc-800"
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-zinc-500">Language</label>
                          <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800/50"
                          >
                            {EXERCISE_LANGUAGES.map((l) => (
                              <option key={l.code} value={l.code}>{l.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-zinc-500">CEFR Level</label>
                          <select
                            value={cefrLevel}
                            onChange={(e) => setCefrLevel(e.target.value)}
                            className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800/50"
                          >
                            <option value="">Auto-detect</option>
                            {effectiveLevels.map((l) => (
                              <option key={l} value={l}>{l}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Topic & Summary */}
                {analysisMetadata?.detectedTopic && (
                  <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/40 p-3.5 dark:border-emerald-800/40 dark:bg-emerald-900/10">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      <Lightbulb className="h-3.5 w-3.5" /> Detected Topic
                    </div>
                    <p className="mt-1 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                      {analysisMetadata.detectedTopic}
                    </p>
                    {analysisMetadata.materialSummary && (
                      <p className="mt-0.5 text-xs leading-relaxed text-emerald-700/80 dark:text-emerald-400/80">
                        {analysisMetadata.materialSummary}
                      </p>
                    )}
                  </div>
                )}

                {/* Existing similar exercises */}
                {existingExercises.length > 0 && (
                  <div className="rounded-xl border border-amber-200/60 bg-amber-50/40 p-3.5 dark:border-amber-800/40 dark:bg-amber-900/10">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      {existingExercises.length} similar exercise{existingExercises.length !== 1 ? "s" : ""} found
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {existingExercises.slice(0, 5).map((ex) => (
                        <div key={ex.id} className="flex items-center gap-2 text-xs">
                          <span className={`rounded-full px-1.5 py-0.5 font-medium ${
                            ex.similarity === "very_high" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : ex.similarity === "high" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}>
                            {ex.similarity}
                          </span>
                          <span className="text-zinc-500">{getTypeLabel(ex.type)}</span>
                          <span className="truncate text-zinc-700 dark:text-zinc-300">{ex.instruction}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Generated Exercises */}
                {generatedExercises.length > 0 && (
                  <div ref={exercisesSectionRef} className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-violet-50/60 px-3 py-2 dark:bg-violet-900/10">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                        <h4 className="text-sm font-semibold text-violet-900 dark:text-violet-200">Generated Exercises</h4>
                        <span className="rounded-full bg-violet-100/80 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                          {selectedGenerated.size}/{generatedExercises.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <button
                          onClick={() => setSelectedGenerated(new Set(generatedExercises.map((e) => e.id)))}
                          className="text-violet-600 hover:text-violet-500 dark:text-violet-400"
                        >
                          Select all
                        </button>
                        <span className="text-zinc-300 dark:text-zinc-600">|</span>
                        <button
                          onClick={() => setSelectedGenerated(new Set())}
                          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                        >
                          Deselect
                        </button>
                        <span className="text-zinc-300 dark:text-zinc-600">|</span>
                        <button
                          onClick={() => {
                            if (previewingIds.size === generatedExercises.length) {
                              setPreviewingIds(new Set());
                            } else {
                              setPreviewingIds(new Set(generatedExercises.map((e) => e.id)));
                            }
                          }}
                          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                        >
                          {previewingIds.size === generatedExercises.length ? "Collapse all" : "Expand all"}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {generatedExercises.map((ex) => (
                        <div
                          key={ex.id}
                          className={`overflow-hidden rounded-xl border transition-all duration-200 ${
                            selectedGenerated.has(ex.id)
                              ? "border-violet-200/80 bg-white shadow-sm dark:border-violet-800/60 dark:bg-zinc-900"
                              : "border-zinc-200/40 bg-zinc-50/50 opacity-60 dark:border-zinc-700/40 dark:bg-zinc-900/50"
                          }`}
                        >
                          <div className="flex items-center gap-3 p-3">
                            {/* Checkbox */}
                            <button
                              onClick={() => toggleSelect(ex.id)}
                              className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-all ${
                                selectedGenerated.has(ex.id)
                                  ? "border-violet-500 bg-violet-500 text-white"
                                  : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-600"
                              }`}
                            >
                              {selectedGenerated.has(ex.id) && <Check className="h-2.5 w-2.5" />}
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1">
                                <span className="text-zinc-400">{getTypeIcon(ex.type)}</span>
                                <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                  {getTypeLabel(ex.type)}
                                </span>
                                <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-600 dark:bg-violet-900/20 dark:text-violet-400">
                                  {ex.targetSkill}
                                </span>
                              </div>
                              {ex.title && <p className="mt-0.5 text-sm font-semibold leading-snug">{ex.title}</p>}
                              <p className="text-[13px] leading-snug text-zinc-700 dark:text-zinc-300">{ex.instruction}</p>
                              <p className="mt-0.5 text-xs text-zinc-400 line-clamp-1">{ex.content}</p>
                              {/* Metadata row */}
                              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                                {ex.correctAnswer && (
                                  <span className="flex items-center gap-1">
                                    <Check className="h-3 w-3 text-emerald-500" />
                                    <span className="max-w-32 truncate">{ex.correctAnswer}</span>
                                  </span>
                                )}
                                {ex.options && ex.options.length > 0 && (
                                  <span>{ex.options.length} options</span>
                                )}
                                {ex.audioUrl && <Volume2 className="h-3 w-3" />}
                                {ex.videoUrl && <Video className="h-3 w-3" />}
                                {ex.imageUrl && <ImageIcon className="h-3 w-3" />}
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-0.5">
                              <button onClick={() => togglePreview(ex.id)} className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800" title="Preview">
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => toggleEdit(ex.id)} className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800" title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteExercise(ex.id)}
                                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Preview */}
                          {previewingIds.has(ex.id) && (
                            <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">
                              <ExerciseRenderer exercise={ex} mode="interactive" />
                            </div>
                          )}

                          {/* Inline edit */}
                          {editingIds.has(ex.id) && (
                            <div className="space-y-3 border-t border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-800/30">
                              <div className="space-y-1.5">
                                <label className="text-xs font-medium text-zinc-500">Instruction</label>
                                <input
                                  value={editDrafts[ex.id]?.instruction ?? ex.instruction}
                                  onChange={(e) => setEditDrafts((prev) => ({ ...prev, [ex.id]: { ...prev[ex.id], instruction: e.target.value } }))}
                                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-medium text-zinc-500">Content</label>
                                <textarea
                                  value={editDrafts[ex.id]?.content ?? ex.content}
                                  onChange={(e) => setEditDrafts((prev) => ({ ...prev, [ex.id]: { ...prev[ex.id], content: e.target.value } }))}
                                  rows={2}
                                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                                />
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium text-zinc-500">Correct Answer</label>
                                  <input
                                    value={editDrafts[ex.id]?.correctAnswer ?? ex.correctAnswer ?? ""}
                                    onChange={(e) => setEditDrafts((prev) => ({ ...prev, [ex.id]: { ...prev[ex.id], correctAnswer: e.target.value } }))}
                                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                                  />
                                </div>
                                <div className="space-y-1.5">
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
                                  className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-500"
                                >
                                  <Save className="h-3.5 w-3.5" /> Apply
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
                  </div>
                )}

                {generatedExercises.length === 0 && (
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <Sparkles className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                    <p className="text-sm text-zinc-400">No exercises generated yet. Go back and analyze material.</p>
                  </div>
                )}
              </div>

              {/* ── Right column: Chat ── */}
              <div className="w-full shrink-0 lg:w-72 xl:w-80">
                <div className="lg:sticky lg:top-0">
                  <LessonPlanChat
                    onSend={handleRefineExercises}
                    disabled={analyzing}
                    materialText={materialText}
                    lessonInfo={{
                      title,
                      description,
                      language,
                      cefrLevel,
                      topic: analysisMetadata?.detectedTopic,
                      summary: analysisMetadata?.materialSummary,
                    }}
                    planItems={generatedExercises.map((ex) => ({
                      type: ex.type,
                      count: 1,
                      reason: ex.instruction,
                    }))}
                    exerciseTypes={Object.entries(EXERCISE_TYPE_CONFIG).map(([type, cfg]) => ({
                      type,
                      label: cfg.label,
                      description: cfg.description,
                    }))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ═══ STEP 2: Confirm & Save ═══ */}
          {step === 2 && (
            <div className="mx-auto max-w-3xl space-y-5">
              {/* Summary card */}
              <div className="rounded-xl border border-zinc-200/80 bg-white p-5 space-y-4 dark:border-zinc-700/80 dark:bg-zinc-900">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h4 className="text-sm font-semibold">Lesson Summary</h4>
                </div>
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Title</p>
                    <p className="text-sm font-medium">{title || editingLesson?.title}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Language</p>
                    <p className="text-sm font-medium">{EXERCISE_LANGUAGES.find((l) => l.code === language)?.name ?? language}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">CEFR Level</p>
                    <p className="text-sm font-medium">{cefrLevel}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Exercises</p>
                    <p className="text-sm font-medium">{selectedGenerated.size} selected</p>
                  </div>
                </div>
              </div>

              {/* Exercise list preview */}
              {generatedExercises.filter((e) => selectedGenerated.has(e.id)).length > 0 && (
                <div className="rounded-xl border border-zinc-200/80 bg-white dark:border-zinc-700/80 dark:bg-zinc-900">
                  <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                    <h4 className="text-sm font-medium">Exercises to save</h4>
                  </div>
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {generatedExercises
                      .filter((e) => selectedGenerated.has(e.id))
                      .map((ex, i) => (
                        <div key={ex.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-semibold tabular-nums text-zinc-500 dark:bg-zinc-800">
                            {i + 1}
                          </span>
                          <span className="text-zinc-400">{getTypeIcon(ex.type)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                {getTypeLabel(ex.type)}
                              </span>
                              <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-600 dark:bg-violet-900/20 dark:text-violet-400">
                                {ex.targetSkill}
                              </span>
                            </div>
                            {ex.title && <p className="mt-0.5 text-sm font-medium leading-snug">{ex.title}</p>}
                            <p className="text-xs text-zinc-500 line-clamp-1">{ex.instruction}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
          </div>

          {/* ═══ Fixed Footer ═══ */}
          <div className="shrink-0 border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
            {step === 0 && (
              <div className="flex justify-end">
                <Button
                  onClick={handleAnalyze}
                  disabled={analyzing || (!materialText.trim() && selectedMedia.length === 0)}
                  className="bg-gradient-to-r from-violet-600 to-purple-600 text-white"
                >
                  {analyzing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing & Generating...</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" /> Analyze & Generate</>
                  )}
                </Button>
              </div>
            )}
            {step === 1 && (
              <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => setStep(0)}>
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleAnalyze}
                    disabled={analyzing}
                  >
                    {analyzing ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Regenerating...</>
                    ) : (
                      <><RefreshCw className="mr-2 h-4 w-4" /> Regenerate All</>
                    )}
                  </Button>
                  <Button
                    onClick={() => setStep(2)}
                    disabled={selectedGenerated.size === 0}
                    className="bg-violet-600 text-white hover:bg-violet-500"
                  >
                    Next <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleSave("draft")}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save as Draft
                  </Button>
                  <Button
                    onClick={() => handleSave("ready")}
                    disabled={saving}
                    className="bg-emerald-600 text-white hover:bg-emerald-500"
                  >
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Publish
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Media Library Sidebar */}
      <MediaLibrarySidebar
        open={mediaOpen}
        onOpenChange={setMediaOpen}
        onSelect={handleMediaSelect}
        initialSelectedIds={selectedMedia.map((m) => m.mediaItemId)}
      />
    </>
  );
}
