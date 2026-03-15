"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Sparkles,
  Wrench,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Search,
  Filter,
  BookOpen,
  Plus,
  Save,
  Send,
  AlertCircle,
} from "lucide-react";
import { EXERCISE_LANGUAGES, CourseStatus } from "@langopia/shared/types";
import type {
  CourseResponse,
  GenerateCourseResponse,
} from "@langopia/api-client";
import { toast } from "sonner";
import { useApiClient } from "@/hooks/use-api-client";
import { useApiKeyClient } from "@/hooks/use-api-client";
import { useAcademyLevels } from "@/hooks/use-academy-levels";
import { useAcademy } from "@/components/academy-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CourseTreeBuilder,
  type TreeModule,
  type TreeLesson,
} from "@/components/course-tree-builder";
import { LessonPlanChat } from "@/components/lesson-plan-chat";

// ─── Types ──────────────────────────────────────────────

interface CourseWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCourse?: CourseResponse;
  onComplete?: () => void;
}

interface AvailableLesson {
  id: string;
  title: string;
  language: string;
  cefrLevel: string;
  status: string;
  description?: string | null;
}

type WizardMode = "ai" | "manual";

// ─── Step Indicator ─────────────────────────────────────

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition ${
              i < current
                ? "bg-violet-600 text-white"
                : i === current
                  ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                  : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
            }`}
          >
            {i + 1}
          </div>
          <span
            className={`hidden text-xs sm:inline ${
              i === current ? "font-medium text-zinc-700 dark:text-zinc-300" : "text-zinc-400"
            }`}
          >
            {label}
          </span>
          {i < steps.length - 1 && (
            <ChevronRight className="h-3 w-3 text-zinc-300 dark:text-zinc-600" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────

export function CourseWizard({
  open,
  onOpenChange,
  editingCourse,
  onComplete,
}: CourseWizardProps) {
  const { selectedAcademy } = useAcademy();
  const api = useApiClient();
  const apiKey = useApiKeyClient();
  const { levelCodes } = useAcademyLevels();

  // Step 0 state
  const [mode, setMode] = useState<WizardMode>("ai");
  const [language, setLanguage] = useState("en");
  const [cefrLevel, setCefrLevel] = useState("B1");
  const [prompt, setPrompt] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualDescription, setManualDescription] = useState("");

  // Step state
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // AI plan state
  const [plan, setPlan] = useState<GenerateCourseResponse | null>(null);

  // Tree state (shared between AI and manual)
  const [modules, setModules] = useState<TreeModule[]>([]);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [estimatedHours, setEstimatedHours] = useState<number>(0);

  // Manual mode: available lessons
  const [availableLessons, setAvailableLessons] = useState<AvailableLesson[]>([]);
  const [lessonSearch, setLessonSearch] = useState("");
  const [loadingLessons, setLoadingLessons] = useState(false);

  // Saving
  const [saving, setSaving] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      if (editingCourse) {
        // Edit mode — load existing course into manual mode
        setMode("manual");
        setLanguage(editingCourse.language);
        setCefrLevel(editingCourse.cefrLevel);
        setCourseTitle(editingCourse.title);
        setCourseDescription(editingCourse.description ?? "");
        setEstimatedHours(editingCourse.estimatedHours ?? 0);
        setManualTitle(editingCourse.title);
        setManualDescription(editingCourse.description ?? "");

        // Group existing lessons by moduleTitle
        const lessonsByModule = new Map<string, TreeLesson[]>();
        const sorted = [...(editingCourse.courseLessons ?? [])].sort(
          (a, b) => (a.moduleOrder ?? 0) - (b.moduleOrder ?? 0) || a.sortOrder - b.sortOrder,
        );
        for (const cl of sorted) {
          const key = cl.moduleTitle ?? "Ungrouped";
          if (!lessonsByModule.has(key)) lessonsByModule.set(key, []);
          lessonsByModule.get(key)!.push({
            id: cl.lesson.id,
            suggestedTitle: cl.lesson.title,
            matchedLesson: {
              id: cl.lesson.id,
              title: cl.lesson.title,
              status: cl.lesson.status,
              exerciseCount: 0,
            },
            matchScore: 1,
          });
        }
        const mods: TreeModule[] = [];
        for (const [title, lessons] of lessonsByModule) {
          mods.push({ id: `mod-${mods.length}`, title, lessons });
        }
        if (mods.length === 0) {
          mods.push({ id: "mod-0", title: "Module 1", lessons: [] });
        }
        setModules(mods);
        setStep(1);
      } else {
        setMode("ai");
        setLanguage("en");
        setCefrLevel("B1");
        setPrompt("");
        setManualTitle("");
        setManualDescription("");
        setPlan(null);
        setModules([]);
        setCourseTitle("");
        setCourseDescription("");
        setEstimatedHours(0);
        setStep(0);
      }
    }
  }, [open, editingCourse]);

  // Load available lessons for manual mode
  const loadAvailableLessons = useCallback(async () => {
    if (!selectedAcademy) return;
    setLoadingLessons(true);
    try {
      const data = await apiKey.lessons.list({
        limit: 200,
        language: language !== "all" ? language : undefined,
        cefrLevel: cefrLevel !== "all" ? cefrLevel : undefined,
      });
      setAvailableLessons((data.data ?? []) as unknown as AvailableLesson[]);
    } catch {
      // ignore
    } finally {
      setLoadingLessons(false);
    }
  }, [apiKey, selectedAcademy, language, cefrLevel, lessonSearch]);

  // ─── Step 0: Generate or go manual ────────────────────

  async function handleGenerate() {
    if (!selectedAcademy) return;
    setLoading(true);
    try {
      const result = await api.courses.generate(selectedAcademy, {
        prompt,
        language,
        cefrLevel,
      });
      setPlan(result);
      setCourseTitle(result.suggestedTitle);
      setCourseDescription(result.suggestedDescription);
      setEstimatedHours(result.estimatedHours);

      // Convert plan modules to tree modules
      const treeModules: TreeModule[] = result.modules.map((mod, i) => ({
        id: `mod-${i}`,
        title: mod.title,
        lessons: mod.lessons.map((l, j) => ({
          id: l.matchedLesson?.id ?? `unmatched-${i}-${j}`,
          suggestedTitle: l.suggestedTitle,
          matchedLesson: l.matchedLesson,
          matchScore: l.matchScore,
        })),
      }));
      setModules(treeModules);
      setStep(1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate course plan";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  function handleGoManual() {
    setCourseTitle(manualTitle);
    setCourseDescription(manualDescription);
    if (modules.length === 0) {
      setModules([{ id: "mod-0", title: "Module 1", lessons: [] }]);
    }
    loadAvailableLessons();
    setStep(1);
  }

  // ─── Step 1: Refine (AI) or Build (Manual) ────────────

  async function handleRefinePlan(message: string, signal?: AbortSignal): Promise<string> {
    if (!selectedAcademy || !plan) return "No plan to refine.";

    const currentPlan = {
      suggestedTitle: courseTitle,
      modules: modules.map((m) => ({
        title: m.title,
        lessons: m.lessons.map((l) => ({
          suggestedTitle: l.suggestedTitle,
          matchedLessonId: l.matchedLesson?.id,
        })),
      })),
    };

    const result = await api.courses.refinePlan(selectedAcademy, {
      currentPlan,
      userMessage: message,
      language,
      cefrLevel,
    });

    // Update state with refined plan
    setCourseTitle(result.suggestedTitle);
    setCourseDescription(result.suggestedDescription);
    setEstimatedHours(result.estimatedHours);

    const treeModules: TreeModule[] = result.modules.map((mod, i) => ({
      id: `mod-${i}`,
      title: mod.title,
      lessons: mod.lessons.map((l, j) => ({
        id: l.matchedLesson?.id ?? `unmatched-${i}-${j}`,
        suggestedTitle: l.suggestedTitle,
        matchedLesson: l.matchedLesson,
        matchScore: l.matchScore,
      })),
    }));
    setModules(treeModules);

    return result.aiResponse ?? "Plan updated.";
  }

  function addLessonToModule(lesson: AvailableLesson, moduleId: string) {
    // Check not already in any module
    const alreadyUsed = modules.some((m) =>
      m.lessons.some((l) => l.matchedLesson?.id === lesson.id),
    );
    if (alreadyUsed) {
      toast.error("Lesson already in course");
      return;
    }

    const newLesson: TreeLesson = {
      id: lesson.id,
      suggestedTitle: lesson.title,
      matchedLesson: {
        id: lesson.id,
        title: lesson.title,
        status: lesson.status,
        exerciseCount: 0,
      },
      matchScore: 1,
    };

    setModules((prev) =>
      prev.map((m) =>
        m.id === moduleId ? { ...m, lessons: [...m.lessons, newLesson] } : m,
      ),
    );
  }

  // ─── Step 2: Save ─────────────────────────────────────

  async function handleSave(status: CourseStatus) {
    if (!selectedAcademy) return;
    setSaving(true);
    try {
      let courseId: string;

      if (editingCourse) {
        // Update existing course
        await api.courses.update(selectedAcademy, editingCourse.id, {
          title: courseTitle,
          description: courseDescription || undefined,
          language,
          cefrLevel,
          estimatedHours: estimatedHours || undefined,
          status,
        });
        courseId = editingCourse.id;
      } else {
        // Create new course
        const created = await api.courses.create(selectedAcademy, {
          title: courseTitle,
          language,
          cefrLevel,
          description: courseDescription || undefined,
          estimatedHours: estimatedHours || undefined,
        });
        courseId = created.id;

        // Set status if published
        if (status !== CourseStatus.DRAFT) {
          await api.courses.update(selectedAcademy, courseId, { status });
        }
      }

      // Set lessons with module info
      const allLessons: Array<{
        lessonId: string;
        sortOrder: number;
        moduleTitle?: string;
        moduleOrder?: number;
      }> = [];
      let sortIdx = 0;
      for (let modIdx = 0; modIdx < modules.length; modIdx++) {
        const mod = modules[modIdx];
        for (const lesson of mod.lessons) {
          if (lesson.matchedLesson) {
            allLessons.push({
              lessonId: lesson.matchedLesson.id,
              sortOrder: sortIdx++,
              moduleTitle: mod.title,
              moduleOrder: modIdx,
            });
          }
        }
      }

      if (allLessons.length > 0) {
        await api.courses.setLessons(selectedAcademy, courseId, {
          lessons: allLessons,
        });
      }

      toast.success(editingCourse ? "Course updated" : "Course created");
      onOpenChange(false);
      onComplete?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save course";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  // ─── Lesson IDs already in tree ───────────────────────
  const usedLessonIds = new Set(
    modules.flatMap((m) => m.lessons.filter((l) => l.matchedLesson).map((l) => l.matchedLesson!.id)),
  );
  const filteredAvailableLessons = availableLessons.filter((l) => {
    if (usedLessonIds.has(l.id)) return false;
    if (lessonSearch.trim()) {
      return l.title.toLowerCase().includes(lessonSearch.toLowerCase());
    }
    return true;
  });

  const stepLabels =
    mode === "ai"
      ? ["Configure", "AI Plan", "Save"]
      : ["Configure", "Build", "Save"];

  const matchedCount = modules.reduce(
    (acc, m) => acc + m.lessons.filter((l) => l.matchedLesson).length,
    0,
  );
  const totalSlots = modules.reduce((acc, m) => acc + m.lessons.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              {editingCourse ? "Edit Course" : "Course Wizard"}
            </DialogTitle>
            <StepIndicator current={step} steps={stepLabels} />
          </div>
        </DialogHeader>

        {/* ─── Step 0: Mode & Configuration ─── */}
        {step === 0 && (
          <div className="space-y-5 overflow-y-auto p-1" style={{ maxHeight: "70vh" }}>
            {/* Mode toggle */}
            <div className="flex gap-3">
              <button
                onClick={() => setMode("ai")}
                className={`flex flex-1 items-center gap-3 rounded-xl border-2 p-4 transition ${
                  mode === "ai"
                    ? "border-violet-500 bg-violet-50/50 dark:border-violet-400 dark:bg-violet-900/10"
                    : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
                  <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="text-left">
                  <p className="font-semibold">Generate with AI</p>
                  <p className="text-xs text-zinc-500">
                    Describe your course and AI will organize it
                  </p>
                </div>
              </button>
              <button
                onClick={() => setMode("manual")}
                className={`flex flex-1 items-center gap-3 rounded-xl border-2 p-4 transition ${
                  mode === "manual"
                    ? "border-violet-500 bg-violet-50/50 dark:border-violet-400 dark:bg-violet-900/10"
                    : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <Wrench className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div className="text-left">
                  <p className="font-semibold">Build manually</p>
                  <p className="text-xs text-zinc-500">
                    Drag and drop lessons into modules
                  </p>
                </div>
              </button>
            </div>

            {/* Language + CEFR */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-500">Language</label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXERCISE_LANGUAGES.map((l) => (
                      <SelectItem key={l.code} value={l.code}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-500">CEFR Level</label>
                <Select value={cefrLevel} onValueChange={setCefrLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {levelCodes.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Mode-specific input */}
            {mode === "ai" ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-500">
                  Describe the course you want to create
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. A 10-week Business English course for B1 students covering meetings, email writing, presentations, and negotiations..."
                  rows={4}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-violet-500"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-500">Title *</label>
                  <Input
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    placeholder="e.g. Business English Fundamentals"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-500">Description</label>
                  <textarea
                    value={manualDescription}
                    onChange={(e) => setManualDescription(e.target.value)}
                    placeholder="Optional course description..."
                    rows={2}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-violet-500"
                  />
                </div>
              </div>
            )}

            {/* Next button */}
            <div className="flex justify-end">
              <Button
                onClick={mode === "ai" ? handleGenerate : handleGoManual}
                disabled={
                  loading ||
                  (mode === "ai" && !prompt.trim()) ||
                  (mode === "manual" && !manualTitle.trim())
                }
                className="bg-gradient-accent text-white shadow-md rounded-xl px-6 py-2.5 text-sm font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    Next <ChevronRight className="ml-1 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ─── Step 1a: AI Plan ─── */}
        {step === 1 && mode === "ai" && (
          <div className="flex gap-4 overflow-hidden" style={{ maxHeight: "70vh" }}>
            {/* Left: Course tree */}
            <div className="flex-1 space-y-3 overflow-y-auto pr-2">
              {/* Title editable */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-500">Course Title</label>
                <Input
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  className="font-semibold"
                />
              </div>

              {plan?.noLessonsAvailable && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">No lessons available</p>
                    <p className="text-xs">
                      Your academy doesn&apos;t have lessons matching this course.
                      Create lessons first, then come back to build the course.
                    </p>
                  </div>
                </div>
              )}

              <CourseTreeBuilder
                modules={modules}
                onChange={setModules}
              />
            </div>

            {/* Right: Chat */}
            <div className="w-80 shrink-0">
              <LessonPlanChat
                onSend={handleRefinePlan}
                lessonInfo={{
                  title: courseTitle,
                  description: courseDescription,
                  language,
                  cefrLevel,
                }}
              />
            </div>
          </div>
        )}

        {/* ─── Step 1b: Manual Build ─── */}
        {step === 1 && mode === "manual" && (
          <div className="flex gap-4 overflow-hidden" style={{ maxHeight: "70vh" }}>
            {/* Left: Available lessons */}
            <div className="w-72 shrink-0 space-y-2 overflow-hidden">
              <p className="text-xs font-medium text-zinc-500">Available Lessons</p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={lessonSearch}
                  onChange={(e) => {
                    setLessonSearch(e.target.value);
                    loadAvailableLessons();
                  }}
                  placeholder="Search lessons..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
                {loadingLessons ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                  </div>
                ) : filteredAvailableLessons.length === 0 ? (
                  <p className="py-4 text-center text-xs text-zinc-400">
                    No available lessons
                  </p>
                ) : (
                  filteredAvailableLessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className="group flex items-center gap-2 rounded-lg border border-zinc-200/60 bg-white px-2.5 py-2 dark:border-zinc-700/60 dark:bg-zinc-900"
                    >
                      <BookOpen className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-medium">{lesson.title}</p>
                        <p className="text-[10px] text-zinc-400">
                          {lesson.language.toUpperCase()} &middot; {lesson.cefrLevel}
                        </p>
                      </div>
                      {/* Add to first module with a dropdown */}
                      <div className="relative">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              addLessonToModule(lesson, e.target.value);
                              e.target.value = "";
                            }
                          }}
                          className="h-6 w-6 cursor-pointer appearance-none rounded bg-violet-100 text-center text-xs text-violet-600 opacity-0 transition group-hover:opacity-100 dark:bg-violet-900/30 dark:text-violet-400"
                          title="Add to module"
                          defaultValue=""
                        >
                          <option value="" disabled>
                            +
                          </option>
                          {modules.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.title}
                            </option>
                          ))}
                        </select>
                        <Plus className="pointer-events-none absolute left-1 top-1 h-4 w-4 text-violet-600 opacity-0 transition group-hover:opacity-100 dark:text-violet-400" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Course tree */}
            <div className="flex-1 space-y-3 overflow-y-auto pr-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-500">Course Title</label>
                <Input
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  className="font-semibold"
                />
              </div>
              <CourseTreeBuilder
                modules={modules}
                onChange={setModules}
              />
            </div>
          </div>
        )}

        {/* ─── Step 2: Confirm & Save ─── */}
        {step === 2 && (
          <div className="space-y-4 overflow-y-auto p-1" style={{ maxHeight: "70vh" }}>
            {/* Summary fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-zinc-500">Title</label>
                <Input
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-zinc-500">Description</label>
                <textarea
                  value={courseDescription}
                  onChange={(e) => setCourseDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-violet-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-500">Language</label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXERCISE_LANGUAGES.map((l) => (
                      <SelectItem key={l.code} value={l.code}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-500">CEFR Level</label>
                <Select value={cefrLevel} onValueChange={setCefrLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {levelCodes.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-500">Estimated Hours</label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={estimatedHours || ""}
                  onChange={(e) => setEstimatedHours(e.target.value ? Number(e.target.value) : 0)}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 rounded-lg bg-zinc-50 px-4 py-2.5 text-sm dark:bg-zinc-800/50">
              <span>
                <strong>{modules.length}</strong> module{modules.length !== 1 ? "s" : ""}
              </span>
              <span className="text-zinc-300 dark:text-zinc-600">&middot;</span>
              <span>
                <strong>{totalSlots}</strong> lesson slot{totalSlots !== 1 ? "s" : ""}
              </span>
              <span className="text-zinc-300 dark:text-zinc-600">&middot;</span>
              <span>
                <strong>{matchedCount}</strong> matched
              </span>
              {totalSlots > matchedCount && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-600">&middot;</span>
                  <span className="text-amber-600 dark:text-amber-400">
                    {totalSlots - matchedCount} unmatched (will be skipped)
                  </span>
                </>
              )}
            </div>

            {/* Read-only tree preview */}
            <CourseTreeBuilder
              modules={modules}
              onChange={setModules}
              readOnly
            />
          </div>
        )}

        {/* ─── Navigation ─── */}
        {step > 0 && (
          <div className="flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => s - 1)}
              disabled={saving}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>

            {step < 2 ? (
              <Button
                onClick={() => setStep(2)}
                disabled={modules.length === 0 || !courseTitle.trim()}
                className="bg-gradient-accent text-white shadow-md rounded-xl px-5 py-2 text-sm font-semibold"
              >
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleSave(CourseStatus.DRAFT)}
                  disabled={saving || !courseTitle.trim()}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save as Draft
                </Button>
                <Button
                  onClick={() => handleSave(CourseStatus.PUBLISHED)}
                  disabled={saving || !courseTitle.trim() || matchedCount === 0}
                  className="bg-gradient-accent text-white shadow-md rounded-xl px-5 py-2 text-sm font-semibold"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Publish
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
