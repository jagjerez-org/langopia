"use client";

import { useState } from "react";
import {
  Sparkles,
  X,
  Plus,
  Minus,
  Check,
  ChevronRight,
  Loader2,
  Lightbulb,
  FolderOpen,
  AlertCircle,
  RefreshCw,
  Library,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { EXERCISE_LANGUAGES, ExerciseType, EXERCISE_TYPE_CONFIG } from "@langopia/shared/types";
import { ApiError } from "@langopia/api-client";
import { toast } from "sonner";
import { useApiKeyClient } from "@/hooks/use-api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MediaLibrarySidebar, type MediaSelection } from "@/components/media-library-sidebar";
import { RegenerateDialog } from "@/components/regenerate-dialog";
import { ExerciseRenderer, type ExerciseData } from "@/components/exercises/exercise-renderer";

// ─── Types ──────────────────────────────────────────────

interface ExerciseWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiKey: string;
  lessonId?: string;
  lessonTitle?: string;
  lessonLanguage?: string;
  lessonCefrLevel?: string;
  levelCodes?: string[];
  onComplete?: () => void;
}

interface ExistingExercise {
  id: string;
  type: string;
  title?: string | null;
  targetSkill: string;
  topic: string | null;
  language: string;
  instruction: string;
  content: string;
  options: string[] | null;
  correctAnswer?: string;
  explanation?: string;
  cefrLevel: string;
  audioUrl?: string | null;
  distance: number;
  matchType: "topic" | "content";
  similarity: "very_high" | "high" | "medium";
}

interface AnalysisResult {
  detectedTopic: string;
  materialSummary: string;
  suggestions: {
    type: string;
    count: number;
    reason: string;
  }[];
  existingExercises?: ExistingExercise[];
}

interface GeneratedExercise {
  id: string;
  type: string;
  title?: string | null;
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
  audioUrl?: string | null;
  videoUrl?: string | null;
  imageUrl?: string | null;
  createdAt: string;
}

// ─── Helpers ────────────────────────────────────────────

function getTypeIcon(type: string) {
  const config = EXERCISE_TYPE_CONFIG[type as ExerciseType];
  if (!config) return <Sparkles className="h-4 w-4" />;
  const IconComp = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[config.icon];
  return IconComp ? <IconComp className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />;
}

// ─── Step Indicator ──────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  const steps = ["Material & Topic", "Exercise Plan", "Review & Save"];
  return (
    <div className="flex items-center gap-1">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-1">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
              i < current
                ? "bg-emerald-500 text-white"
                : i === current
                ? "bg-violet-600 text-white"
                : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
            }`}
          >
            {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </div>
          <span
            className={`hidden text-xs font-medium sm:block ${
              i === current ? "text-violet-600 dark:text-violet-400" : "text-zinc-400"
            }`}
          >
            {label}
          </span>
          {i < steps.length - 1 && (
            <ChevronRight className="h-3.5 w-3.5 text-zinc-300 dark:text-zinc-600" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Wizard ─────────────────────────────────────────

export function ExerciseWizard({
  open,
  onOpenChange,
  apiKey,
  lessonId,
  lessonTitle,
  lessonLanguage,
  lessonCefrLevel,
  levelCodes = [],
  onComplete,
}: ExerciseWizardProps) {
  const api = useApiKeyClient();
  const [step, setStep] = useState(0);

  // Step 1: Material
  const [topic, setTopic] = useState(lessonTitle ?? "");
  const [language, setLanguage] = useState(lessonLanguage ?? "en");
  const [cefrLevel, setCefrLevel] = useState(lessonCefrLevel ?? "B1");
  const [analyzing, setAnalyzing] = useState(false);

  // Media Library
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaSelection[]>([]);
  const [materialContext, setMaterialContext] = useState<string>("");

  // Step 2: Plan
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [planCounts, setPlanCounts] = useState<Record<string, number>>({});
  const [generating, setGenerating] = useState(false);
  const [existingExercises, setExistingExercises] = useState<ExistingExercise[]>([]);
  const [selectedExisting, setSelectedExisting] = useState<Set<string>>(new Set());
  const [addingExisting, setAddingExisting] = useState(false);

  // Step 3: Review
  const [generatedExercises, setGeneratedExercises] = useState<GeneratedExercise[]>([]);
  const [selectedGenerated, setSelectedGenerated] = useState<Set<string>>(new Set());
  const [regenerateExercise, setRegenerateExercise] = useState<GeneratedExercise | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset when dialog closes
  function handleOpenChange(open: boolean) {
    if (!open) {
      setStep(0);
      setTopic(lessonTitle ?? "");
      setLanguage(lessonLanguage ?? "en");
      setCefrLevel(lessonCefrLevel ?? "B1");
      setAnalyzing(false);
      setMediaLibraryOpen(false);
      setSelectedMedia([]);
      setMaterialContext("");
      setAnalysis(null);
      setPlanCounts({});
      setGenerating(false);
      setExistingExercises([]);
      setSelectedExisting(new Set());
      setAddingExisting(false);
      setGeneratedExercises([]);
      setSelectedGenerated(new Set());
      setRegenerateExercise(null);
      setSaving(false);
    }
    onOpenChange(open);
  }

  // ─── Step 1: Analyze ─────────────────────

  function handleMediaSelect(mediaList: MediaSelection[]) {
    setSelectedMedia(mediaList);
    const combinedText = mediaList.map((m) => m.extractedText).join("\n\n---\n\n");
    setMaterialContext(combinedText);
    const first = mediaList[0];
    if (first) {
      if (first.detectedTopic && !lessonTitle) setTopic(first.detectedTopic);
      if (first.detectedLanguage && !lessonLanguage) setLanguage(first.detectedLanguage);
      if (first.detectedCefrLevel && !lessonCefrLevel) setCefrLevel(first.detectedCefrLevel);
    }
  }

  async function handleAnalyze() {
    if (!topic.trim() && !materialContext) {
      toast.error("Provide a topic or select material from the media library");
      return;
    }

    setAnalyzing(true);
    try {
      const data = await api.exercises.analyze(null, {
        topic: topic.trim() || undefined,
        language,
        cefrLevel,
        materialContext: materialContext || undefined,
      });
      setAnalysis(data as unknown as AnalysisResult);

      if (data.existingExercises && data.existingExercises.length > 0) {
        setExistingExercises(data.existingExercises);
        // Pre-select very_high and high similarity exercises
        setSelectedExisting(
          new Set(
            data.existingExercises
              .filter((e) => e.similarity === "very_high" || e.similarity === "high")
              .map((e) => e.id)
          )
        );
      } else {
        setExistingExercises([]);
        setSelectedExisting(new Set());
      }

      if (!topic.trim() && data.detectedTopic) {
        setTopic(data.detectedTopic);
      }

      // Initialize plan counts from suggestions (keyed by type slug)
      const counts: Record<string, number> = {};
      for (const s of data.suggestions) {
        counts[s.type] = s.count;
      }
      setPlanCounts(counts);

      setStep(1);
    } catch (err) {
      if (err instanceof ApiError && err.isForbidden) {
        toast.error(err.message || "AI token limit exceeded.");
      } else if (err instanceof ApiError) {
        toast.error(err.message || "Analysis failed");
      } else {
        toast.error("Failed to analyze material");
      }
    } finally {
      setAnalyzing(false);
    }
  }

  // ─── Step 2: Add Existing ─────────────────

  async function handleAddExisting() {
    if (!lessonId || selectedExisting.size === 0) return;
    setAddingExisting(true);
    try {
      await api.lessons.linkExercises(lessonId, { exerciseIds: Array.from(selectedExisting) });
      toast.success(`Added ${selectedExisting.size} existing exercise${selectedExisting.size !== 1 ? "s" : ""} to lesson`);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message || "Failed to link exercises");
      } else {
        toast.error("Failed to add exercises to lesson");
      }
    } finally {
      setAddingExisting(false);
    }
  }

  // ─── Step 2: Generate ─────────────────────

  async function handleGenerate() {
    const exercisePlan = Object.entries(planCounts)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => ({ type, count }));

    if (exercisePlan.length === 0) {
      toast.error("Select at least one exercise type with count > 0");
      return;
    }

    setGenerating(true);
    try {
      const result = await api.exercises.create({
        exercises: exercisePlan,
        topic: topic.trim() || analysis?.detectedTopic || "General",
        language,
        cefrLevel,
        materialContext: materialContext || undefined,
        lessonId: lessonId || undefined,
      });

      const generated: GeneratedExercise[] = (result.data ?? []) as unknown as GeneratedExercise[];
      setGeneratedExercises(generated);
      setSelectedGenerated(new Set(generated.map((e) => e.id)));
      setStep(2);
    } catch (err) {
      if (err instanceof ApiError && err.isForbidden) {
        toast.error(err.message || "AI token limit exceeded.");
      } else if (err instanceof ApiError) {
        toast.error(err.message || "Generation failed");
      } else {
        toast.error("Failed to generate exercises");
      }
    } finally {
      setGenerating(false);
    }
  }

  // ─── Step 3: Save ─────────────────────────

  async function handleSave() {
    const deselected = generatedExercises.filter((e) => !selectedGenerated.has(e.id));

    if (deselected.length > 0) {
      setSaving(true);
      try {
        for (const ex of deselected) {
          await api.exercises.delete(ex.id);
          if (lessonId) {
            await api.lessons.unlinkExercise(lessonId, ex.id);
          }
        }
      } catch {
        // Non-fatal
      } finally {
        setSaving(false);
      }
    }

    const kept = generatedExercises.filter((e) => selectedGenerated.has(e.id));
    toast.success(`Saved ${kept.length} exercise${kept.length !== 1 ? "s" : ""}`);
    onComplete?.();
    handleOpenChange(false);
  }

  // ─── Computed ─────────────────────────────

  const totalPlanCount = Object.values(planCounts).reduce((s, c) => s + c, 0);

  const allTypes = Object.values(ExerciseType) as string[];

  // ─── Render ────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Exercise Wizard
          </DialogTitle>
        </DialogHeader>

        <StepIndicator current={step} />

        {/* ═══ STEP 1: Material & Topic ═══ */}
        {step === 0 && (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500">Topic</label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={lessonTitle || "e.g. Business English - Negotiations"}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-violet-500"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-500">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled={!!lessonLanguage}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 disabled:opacity-60"
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
                  disabled={!!lessonCefrLevel}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 disabled:opacity-60"
                >
                  {levelCodes.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Material source */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500">Source material (optional)</label>

              {selectedMedia.length > 0 && (
                <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-900/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-violet-500" />
                      <span className="text-sm font-medium text-violet-700 dark:text-violet-400">
                        {selectedMedia.length} file{selectedMedia.length !== 1 ? "s" : ""} selected
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedMedia([]); setMaterialContext(""); }}
                      className="text-zinc-400 hover:text-red-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 space-y-1">
                    {selectedMedia.map((m) => (
                      <div key={m.mediaItemId} className="flex items-center justify-between text-xs">
                        <span className="truncate text-zinc-600 dark:text-zinc-400">{m.filename}</span>
                        {m.similarExerciseCount > 0 && (
                          <span className="ml-2 flex shrink-0 items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                            <AlertCircle className="h-2.5 w-2.5" />
                            {m.similarExerciseCount}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setMediaLibraryOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-violet-300 px-4 py-3 text-sm font-medium text-violet-600 transition hover:border-violet-400 hover:bg-violet-50/50 dark:border-violet-700 dark:text-violet-400 dark:hover:border-violet-500 dark:hover:bg-violet-900/10"
              >
                <FolderOpen className="h-4 w-4" />
                {selectedMedia.length > 0 ? "Change Selection" : "Open Media Library"}
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleAnalyze}
                disabled={analyzing || (!topic.trim() && !materialContext)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:opacity-50"
              >
                {analyzing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Analyze & Suggest</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ═══ STEP 2: Exercise Plan ═══ */}
        {step === 1 && (
          <div className="space-y-4 pt-2">
            {/* Summary */}
            {analysis?.materialSummary && (
              <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <Lightbulb className="h-3.5 w-3.5" /> Material Summary
                </div>
                <p className="mt-1">{analysis.materialSummary}</p>
              </div>
            )}

            {/* Detected topic */}
            {analysis?.detectedTopic && analysis.detectedTopic !== topic && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500">AI detected topic:</span>
                <span className="font-medium">{analysis.detectedTopic}</span>
                <button
                  onClick={() => setTopic(analysis.detectedTopic)}
                  className="text-xs text-violet-600 hover:text-violet-500"
                >
                  Use this
                </button>
              </div>
            )}

            {/* Existing exercises */}
            {existingExercises.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-900/10">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                  <Library className="h-4 w-4" />
                  {existingExercises.length} existing exercise{existingExercises.length !== 1 ? "s" : ""} found on this topic
                </div>
                <p className="mt-1 text-xs text-amber-600/80 dark:text-amber-400/70">
                  You can reuse these instead of generating duplicates.
                </p>

                <div className="mt-3 space-y-1.5">
                  {existingExercises.map((ex) => {
                    const isSelected = selectedExisting.has(ex.id);
                    const config = EXERCISE_TYPE_CONFIG[ex.type as ExerciseType];
                    return (
                      <div
                        key={ex.id}
                        className={`flex items-start gap-2 rounded-md border px-2.5 py-2 transition ${
                          isSelected
                            ? "border-amber-300 bg-white dark:border-amber-700 dark:bg-zinc-800"
                            : "border-transparent bg-amber-50 dark:bg-amber-900/5"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedExisting((prev) => {
                              const next = new Set(prev);
                              if (next.has(ex.id)) next.delete(ex.id);
                              else next.add(ex.id);
                              return next;
                            });
                          }}
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                            isSelected
                              ? "border-amber-500 bg-amber-500 text-white"
                              : "border-zinc-300 dark:border-zinc-600"
                          }`}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-zinc-400">{getTypeIcon(ex.type)}</span>
                            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                              {config?.label ?? ex.type}
                            </span>
                            {ex.title && (
                              <span className="text-xs text-zinc-500 truncate">— {ex.title}</span>
                            )}
                            <span
                              className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                                ex.similarity === "very_high"
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                  : ex.similarity === "high"
                                    ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                              }`}
                            >
                              {ex.similarity.replace("_", " ")}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-zinc-500 line-clamp-1">
                            {ex.instruction}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {lessonId && selectedExisting.size > 0 && (
                  <button
                    type="button"
                    onClick={handleAddExisting}
                    disabled={addingExisting}
                    className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
                  >
                    {addingExisting ? (
                      <><Loader2 className="h-3 w-3 animate-spin" /> Adding...</>
                    ) : (
                      <><Plus className="h-3 w-3" /> Add {selectedExisting.size} to lesson</>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* All 11 exercise types */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Exercise Types
              </label>
              <div className="space-y-1">
                {allTypes.map((type) => {
                  const config = EXERCISE_TYPE_CONFIG[type as ExerciseType];
                  if (!config) return null;
                  const count = planCounts[type] ?? 0;
                  const suggestion = analysis?.suggestions.find((s) => s.type === type);

                  return (
                    <div
                      key={type}
                      className={`rounded-lg border px-3 py-2.5 transition ${
                        count > 0
                          ? "border-violet-200 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-900/10"
                          : "border-zinc-100 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-800/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`shrink-0 ${count > 0 ? "text-violet-600 dark:text-violet-400" : "text-zinc-400"}`}>
                          {getTypeIcon(type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{config.label}</span>
                            {suggestion && (
                              <span className="shrink-0 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">
                                AI suggested
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500 truncate">{config.description}</p>
                          {suggestion?.reason && count > 0 && (
                            <p className="text-[11px] text-violet-600 dark:text-violet-400 mt-0.5">{suggestion.reason}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPlanCounts((p) => ({ ...p, [type]: Math.max(0, (p[type] ?? 0) - 1) }))}
                            disabled={count <= 0}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-30 dark:border-zinc-700 dark:hover:bg-zinc-700"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center text-sm font-semibold">{count}</span>
                          <button
                            type="button"
                            onClick={() => setPlanCounts((p) => ({ ...p, [type]: Math.min(10, (p[type] ?? 0) + 1) }))}
                            disabled={count >= 10}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-30 dark:border-zinc-700 dark:hover:bg-zinc-700"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between border-t pt-3 dark:border-zinc-800">
              <button
                onClick={() => setStep(0)}
                className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                &larr; Back
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || totalPlanCount === 0}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:opacity-50"
              >
                {generating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Generate {totalPlanCount} Exercise{totalPlanCount !== 1 ? "s" : ""}</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ═══ STEP 3: Review & Save ═══ */}
        {step === 2 && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500">
                {generatedExercises.length} exercise{generatedExercises.length !== 1 ? "s" : ""} generated.
                {selectedGenerated.size < generatedExercises.length && (
                  <span className="ml-1 text-amber-600">
                    ({selectedGenerated.size} selected)
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedGenerated(new Set(generatedExercises.map((e) => e.id)))}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedGenerated(new Set())}
                >
                  Deselect All
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {generatedExercises.map((ex) => {
                const isSelected = selectedGenerated.has(ex.id);
                const config = EXERCISE_TYPE_CONFIG[ex.type as ExerciseType];

                return (
                  <div
                    key={ex.id}
                    className={`rounded-lg border transition ${
                      isSelected
                        ? "border-violet-200 dark:border-violet-800"
                        : "border-zinc-200 opacity-60 dark:border-zinc-700"
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedGenerated((prev) => {
                            const next = new Set(prev);
                            if (next.has(ex.id)) next.delete(ex.id);
                            else next.add(ex.id);
                            return next;
                          });
                        }}
                        className={`flex h-5 w-5 items-center justify-center rounded border transition ${
                          isSelected
                            ? "border-violet-500 bg-violet-500 text-white"
                            : "border-zinc-300 dark:border-zinc-600"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </button>
                      <span className="text-xs text-zinc-400">{getTypeIcon(ex.type)}</span>
                      <span className="text-xs font-medium text-zinc-500">
                        {config?.label ?? ex.type}
                      </span>
                      {ex.title && (
                        <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate">
                          — {ex.title}
                        </span>
                      )}
                      <div className="ml-auto">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRegenerateExercise(ex)}
                          className="h-7 px-2"
                        >
                          <RefreshCw className="h-3 w-3 mr-1" /> Regenerate
                        </Button>
                      </div>
                    </div>

                    {/* Interactive Preview */}
                    <div className="p-3">
                      <ExerciseRenderer
                        exercise={ex as ExerciseData}
                        mode="interactive"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between border-t pt-3 dark:border-zinc-800">
              <button
                onClick={() => setStep(1)}
                className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                &larr; Back
              </button>
              <button
                onClick={handleSave}
                disabled={saving || selectedGenerated.size === 0}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:opacity-50"
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  <><Check className="h-4 w-4" /> Save {selectedGenerated.size} Exercise{selectedGenerated.size !== 1 ? "s" : ""}</>
                )}
              </button>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Media Library Sidebar */}
      <MediaLibrarySidebar
        open={mediaLibraryOpen}
        onOpenChange={setMediaLibraryOpen}
        onSelect={handleMediaSelect}
      />

      {/* Regenerate Dialog */}
      {regenerateExercise && (
        <RegenerateDialog
          open={!!regenerateExercise}
          onOpenChange={(open) => { if (!open) setRegenerateExercise(null); }}
          exerciseId={regenerateExercise.id}
          exerciseType={regenerateExercise.type}
          exerciseTargetSkill={regenerateExercise.targetSkill}
          exerciseInstruction={regenerateExercise.instruction}
          onRegenerated={(updated) => {
            setGeneratedExercises((prev) =>
              prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e))
            );
            setRegenerateExercise(null);
          }}
        />
      )}
    </Dialog>
  );
}
