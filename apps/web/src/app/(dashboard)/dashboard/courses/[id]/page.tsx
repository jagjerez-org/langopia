"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAcademy } from "@/components/academy-provider";
import { useParams, useRouter } from "next/navigation";
import { useApiClient, useApiKeyClient } from "@/hooks/use-api-client";
import { useAcademyLevels } from "@/hooks/use-academy-levels";
import type {
  CourseResponse,
  UpdateCourseRequest,
} from "@langopia/api-client";
import { CourseStatus } from "@langopia/shared/types";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CourseLesson {
  id: string;
  sortOrder: number;
  lesson: { id: string; title: string; status: string };
}

interface AvailableLesson {
  id: string;
  title: string;
  language: string;
  cefrLevel: string;
  status: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  archived: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const lessonStatusColors: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  ready: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  completed: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export default function CourseDetailPage() {
  const { selectedAcademy, loading: academyLoading } = useAcademy();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const api = useApiClient();
  const { levelCodes } = useAcademyLevels();
  const apiKey = useApiKeyClient();

  const [course, setCourse] = useState<CourseResponse | null>(null);
  const [loadingCourse, setLoadingCourse] = useState(true);

  // Editing states
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<UpdateCourseRequest>({});

  // Lesson management
  const [courseLessons, setCourseLessons] = useState<CourseLesson[]>([]);
  const [addLessonOpen, setAddLessonOpen] = useState(false);
  const [availableLessons, setAvailableLessons] = useState<AvailableLesson[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [savingLessons, setSavingLessons] = useState(false);

  // Delete confirmation
  const [deleteCourseOpen, setDeleteCourseOpen] = useState(false);

  const loadCourse = useCallback(async () => {
    if (!selectedAcademy || !id) return;
    setLoadingCourse(true);
    try {
      const data = await api.courses.get(selectedAcademy, id);
      setCourse(data);
      setCourseLessons(
        (data.courseLessons ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
      );
    } catch {
      toast.error("Course not found");
      router.push("/dashboard/courses");
    } finally {
      setLoadingCourse(false);
    }
  }, [api, selectedAcademy, id, router]);

  useEffect(() => {
    if (selectedAcademy) {
      loadCourse();
    }
  }, [selectedAcademy, loadCourse]);

  async function handleUpdateCourse() {
    if (!selectedAcademy || !id) return;
    try {
      const updated = await api.courses.update(selectedAcademy, id, editDraft);
      setCourse(updated);
      setEditing(false);
      toast.success("Course updated");
    } catch {
      toast.error("Failed to update course");
    }
  }

  async function handleUpdateStatus(status: CourseStatus) {
    if (!selectedAcademy || !id) return;
    try {
      const updated = await api.courses.update(selectedAcademy, id, { status });
      setCourse(updated);
      toast.success(`Status changed to ${status}`);
    } catch {
      toast.error("Failed to update status");
    }
  }

  async function handleDeleteCourse() {
    if (!selectedAcademy || !id) return;
    try {
      await api.courses.delete(selectedAcademy, id);
      toast.success("Course deleted");
      router.push("/dashboard/courses");
    } catch {
      toast.error("Failed to delete course");
    }
  }

  async function saveLessonOrder(lessons: CourseLesson[]) {
    if (!selectedAcademy || !id) return;
    setSavingLessons(true);
    try {
      const updated = await api.courses.setLessons(selectedAcademy, id, {
        lessons: lessons.map((cl, idx) => ({
          lessonId: cl.lesson.id,
          sortOrder: idx,
        })),
      });
      setCourse(updated);
      setCourseLessons(
        (updated.courseLessons ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
      );
      toast.success("Lessons updated");
    } catch {
      toast.error("Failed to update lessons");
    } finally {
      setSavingLessons(false);
    }
  }

  function handleMoveLesson(index: number, direction: "up" | "down") {
    const newLessons = [...courseLessons];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newLessons.length) return;
    [newLessons[index], newLessons[swapIndex]] = [newLessons[swapIndex], newLessons[index]];
    setCourseLessons(newLessons);
    saveLessonOrder(newLessons);
  }

  function handleRemoveLesson(index: number) {
    const newLessons = courseLessons.filter((_, i) => i !== index);
    setCourseLessons(newLessons);
    saveLessonOrder(newLessons);
  }

  async function handleOpenAddLesson() {
    setAddLessonOpen(true);
    setLoadingAvailable(true);
    try {
      const data = await apiKey.lessons.list({ limit: 100 });
      setAvailableLessons((data.data ?? []) as unknown as AvailableLesson[]);
    } catch {
      toast.error("Failed to load lessons");
    } finally {
      setLoadingAvailable(false);
    }
  }

  function handleAddLesson(lesson: AvailableLesson) {
    if (courseLessons.some((cl) => cl.lesson.id === lesson.id)) {
      toast.error("Lesson already in course");
      return;
    }
    const newEntry: CourseLesson = {
      id: `temp-${lesson.id}`,
      sortOrder: courseLessons.length,
      lesson: { id: lesson.id, title: lesson.title, status: lesson.status },
    };
    const newLessons = [...courseLessons, newEntry];
    setCourseLessons(newLessons);
    setAddLessonOpen(false);
    saveLessonOrder(newLessons);
  }

  function startEditing() {
    if (!course) return;
    setEditDraft({
      title: course.title,
      description: course.description ?? undefined,
      language: course.language,
      cefrLevel: course.cefrLevel,
      estimatedHours: course.estimatedHours ?? undefined,
    });
    setEditing(true);
  }

  // ─── Loading state ──────────────────────────────────────
  if (academyLoading || loadingCourse) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="glass h-40 animate-pulse rounded-xl" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass h-16 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!course) return null;

  // Filter out lessons already in course for the add dialog
  const courseLessonIds = new Set(courseLessons.map((cl) => cl.lesson.id));
  const filteredAvailable = availableLessons.filter(
    (l) => !courseLessonIds.has(l.id)
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => router.push("/dashboard/courses")}
          className="mb-3 flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Courses
        </button>

        {editing ? (
          /* ─── Edit form ─── */
          <div className="glass space-y-4 rounded-xl p-5">
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500">Title</label>
              <input
                value={editDraft.title ?? ""}
                onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500">Description</label>
              <textarea
                value={editDraft.description ?? ""}
                onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-500">Language</label>
                <input
                  value={editDraft.language ?? ""}
                  onChange={(e) => setEditDraft((d) => ({ ...d, language: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-500">CEFR Level</label>
                <select
                  value={editDraft.cefrLevel ?? ""}
                  onChange={(e) => setEditDraft((d) => ({ ...d, cefrLevel: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                >
                  {levelCodes.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-500">Estimated Hours</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={editDraft.estimatedHours ?? ""}
                  onChange={(e) => setEditDraft((d) => ({ ...d, estimatedHours: e.target.value ? Number(e.target.value) : undefined }))}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleUpdateCourse}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
              >
                <Save className="h-4 w-4" /> Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* ─── Display header ─── */
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{course.title}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                  {course.language.toUpperCase()}
                </span>
                <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                  {course.cefrLevel}
                </span>
                {course.estimatedHours != null && (
                  <span>{course.estimatedHours}h estimated</span>
                )}
                <span>{courseLessons.length} lesson{courseLessons.length !== 1 ? "s" : ""}</span>
              </div>
              {course.description && (
                <p className="mt-2 text-sm text-zinc-500">{course.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={startEditing}
                className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                title="Edit course"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <select
                value={course.status}
                onChange={(e) => handleUpdateStatus(e.target.value as CourseStatus)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize ${statusColors[course.status] ?? "border-zinc-200"}`}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
              <button
                onClick={() => setDeleteCourseOpen(true)}
                className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                title="Delete course"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Lessons Section ─── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Lessons ({courseLessons.length})</h3>
          <button
            onClick={handleOpenAddLesson}
            disabled={savingLessons}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add Lesson
          </button>
        </div>

        {courseLessons.length === 0 ? (
          <div className="glass flex flex-col items-center justify-center rounded-xl py-12 text-center">
            <BookOpen className="mb-3 h-8 w-8 text-zinc-400" />
            <p className="font-medium text-zinc-500">No lessons yet</p>
            <p className="mt-1 text-sm text-zinc-400">
              Add lessons to build your course curriculum
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {courseLessons.map((cl, index) => (
              <div
                key={cl.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-200/60 bg-white p-4 shadow-sm dark:border-zinc-700/60 dark:bg-zinc-900"
              >
                <GripVertical className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{cl.lesson.title}</p>
                </div>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
                    lessonStatusColors[cl.lesson.status] ?? "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {cl.lesson.status}
                </span>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    onClick={() => handleMoveLesson(index, "up")}
                    disabled={index === 0 || savingLessons}
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-30 dark:hover:bg-zinc-800"
                    title="Move up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleMoveLesson(index, "down")}
                    disabled={index === courseLessons.length - 1 || savingLessons}
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-30 dark:hover:bg-zinc-800"
                    title="Move down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleRemoveLesson(index)}
                    disabled={savingLessons}
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 dark:hover:bg-red-900/20"
                    title="Remove from course"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Add Lesson Dialog ─── */}
      <Dialog open={addLessonOpen} onOpenChange={setAddLessonOpen}>
        <DialogContent className="max-h-[70vh] overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Lesson to Course</DialogTitle>
          </DialogHeader>
          {loadingAvailable ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
              ))}
            </div>
          ) : filteredAvailable.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              No available lessons to add
            </p>
          ) : (
            <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {filteredAvailable.map((lesson) => (
                <button
                  key={lesson.id}
                  onClick={() => handleAddLesson(lesson)}
                  className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 p-3 text-left transition hover:border-violet-300 hover:bg-violet-50/50 dark:border-zinc-700 dark:hover:border-violet-600 dark:hover:bg-violet-900/10"
                >
                  <BookOpen className="h-4 w-4 shrink-0 text-zinc-400" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{lesson.title}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-xs text-zinc-500">{lesson.language.toUpperCase()}</span>
                      <span className="text-xs text-zinc-500">{lesson.cefrLevel}</span>
                    </div>
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
                      lessonStatusColors[lesson.status] ?? "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {lesson.status}
                  </span>
                  <Plus className="h-4 w-4 shrink-0 text-violet-500" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Delete course confirmation ─── */}
      <AlertDialog open={deleteCourseOpen} onOpenChange={setDeleteCourseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Course</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the course and remove all lesson associations.
              The lessons themselves will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCourse}
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
