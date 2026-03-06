"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Route,
  ArrowLeft,
  Trash2,
  Check,
  X,
  Plus,
  ChevronUp,
  ChevronDown,
  BookOpen,
  Clock,
  Pencil,
  ExternalLink,
  Library,
} from "lucide-react";
import { CEFR_LEVELS, EXERCISE_LANGUAGES } from "@langopia/shared/types";
import { toast } from "sonner";
import { useAcademy } from "@/components/academy-provider";
import { useParams, useRouter } from "next/navigation";
import { useApiClient, useApiKeyClient } from "@/hooks/use-api-client";
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

interface LearningPath {
  id: string;
  title: string;
  description: string | null;
  language: string;
  cefrLevel: string;
  status: string;
  thumbnailUrl: string | null;
  estimatedHours: number | null;
  createdAt: string;
  updatedAt: string;
  lessons: PathLesson[];
}

interface PathLesson {
  id: string;
  title: string;
  description: string | null;
  language: string;
  cefrLevel: string;
  status: string;
  exerciseCount: number;
  sortOrder: number;
}

interface AvailableLesson {
  id: string;
  title: string;
  language: string;
  cefrLevel: string;
  status: string;
  exerciseCount: number;
}

interface PathCourse {
  id: string;
  title: string;
  description: string | null;
  language: string;
  cefrLevel: string;
  status: string;
  lessonCount?: number;
  sortOrder: number;
}

interface AvailableCourse {
  id: string;
  title: string;
  language: string;
  cefrLevel: string;
  status: string;
  lessonCount?: number;
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

export default function LearningPathDetailPage() {
  const { selectedAcademy, loading: academyLoading } = useAcademy();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const api = useApiKeyClient();
  const jwtApi = useApiClient();

  const [path, setPath] = useState<LearningPath | null>(null);
  const [loadingPath, setLoadingPath] = useState(true);

  // Editing state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [editingHours, setEditingHours] = useState(false);
  const [hoursDraft, setHoursDraft] = useState("");

  // Add lesson modal
  const [addLessonOpen, setAddLessonOpen] = useState(false);
  const [availableLessons, setAvailableLessons] = useState<AvailableLesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [addingLessonId, setAddingLessonId] = useState<string | null>(null);

  // Delete confirmations
  const [deleteLessonId, setDeleteLessonId] = useState<string | null>(null);
  const [deletePathOpen, setDeletePathOpen] = useState(false);

  // Course management
  const [courses, setCourses] = useState<PathCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>([]);
  const [loadingAvailableCourses, setLoadingAvailableCourses] = useState(false);
  const [addingCourseId, setAddingCourseId] = useState<string | null>(null);
  const [deleteCourseId, setDeleteCourseId] = useState<string | null>(null);

  const loadPath = useCallback(async () => {
    if (!id) return;
    setLoadingPath(true);
    try {
      setPath(await api.learningPaths.get(id) as unknown as LearningPath);
    } catch {
      toast.error("Learning path not found");
      router.push("/dashboard/learning-paths");
    } finally {
      setLoadingPath(false);
    }
  }, [api, id, router]);

  const loadAvailableLessons = useCallback(async () => {
    setLoadingLessons(true);
    try {
      const data = await api.lessons.list({
        language: path?.language || undefined,
        limit: 200,
      });
      setAvailableLessons((data.data ?? []) as unknown as AvailableLesson[]);
    } catch {
      // ignore
    } finally {
      setLoadingLessons(false);
    }
  }, [api, path?.language]);

  useEffect(() => {
    if (selectedAcademy) loadPath();
  }, [selectedAcademy, loadPath]);

  useEffect(() => {
    if (addLessonOpen) loadAvailableLessons();
  }, [addLessonOpen, loadAvailableLessons]);

  const loadCourses = useCallback(async () => {
    if (!id) return;
    setLoadingCourses(true);
    try {
      const data = await api.learningPaths.listCourses(id);
      setCourses((data ?? []) as unknown as PathCourse[]);
    } catch {
      // ignore
    } finally {
      setLoadingCourses(false);
    }
  }, [api, id]);

  const loadAvailableCourses = useCallback(async () => {
    if (!selectedAcademy) return;
    setLoadingAvailableCourses(true);
    try {
      const data = await jwtApi.courses.list(selectedAcademy, { limit: 100 });
      setAvailableCourses((data.data ?? []) as unknown as AvailableCourse[]);
    } catch {
      // ignore
    } finally {
      setLoadingAvailableCourses(false);
    }
  }, [jwtApi, selectedAcademy]);

  useEffect(() => {
    if (selectedAcademy && id) loadCourses();
  }, [selectedAcademy, id, loadCourses]);

  useEffect(() => {
    if (addCourseOpen) loadAvailableCourses();
  }, [addCourseOpen, loadAvailableCourses]);

  async function handleAddCourse(courseId: string) {
    setAddingCourseId(courseId);
    try {
      await api.learningPaths.addCourses(id, [courseId]);
      toast.success("Course added");
      setAddCourseOpen(false);
      loadCourses();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add course";
      toast.error(message);
    } finally {
      setAddingCourseId(null);
    }
  }

  async function handleRemoveCourse(courseId: string) {
    try {
      await api.learningPaths.removeCourse(id, courseId);
      setDeleteCourseId(null);
      toast.success("Course removed from path");
      loadCourses();
    } catch {
      toast.error("Failed to remove course");
    }
  }

  async function handleMoveCourse(courseId: string, direction: "up" | "down") {
    const list = [...courses];
    const idx = list.findIndex((c) => c.id === courseId);
    if (idx < 0) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= list.length) return;

    [list[idx], list[swapIdx]] = [list[swapIdx], list[idx]];
    const newOrder = list.map((c) => c.id);

    // Optimistic update
    setCourses(list.map((c, i) => ({ ...c, sortOrder: i })));

    try {
      await api.learningPaths.reorderCourses(id, newOrder);
    } catch {
      loadCourses();
    }
  }

  async function handleUpdateField(field: string, value: unknown) {
    try {
      const updated = await api.learningPaths.update(id, { [field]: value });
      setPath((prev) => prev ? { ...prev, ...(updated as unknown as LearningPath) } : prev);
    } catch {
      toast.error("Failed to update");
    }
  }

  async function handleUpdateTitle() {
    if (!titleDraft.trim()) return;
    await handleUpdateField("title", titleDraft);
    setEditingTitle(false);
  }

  async function handleUpdateDescription() {
    await handleUpdateField("description", descriptionDraft || null);
    setEditingDescription(false);
  }

  async function handleUpdateHours() {
    const val = hoursDraft ? parseFloat(hoursDraft) : null;
    await handleUpdateField("estimatedHours", val);
    setEditingHours(false);
  }

  async function handleUpdateStatus(status: string) {
    await handleUpdateField("status", status);
  }

  async function handleDeletePath() {
    try {
      await api.learningPaths.delete(id);
      toast.success("Learning path deleted");
      router.push("/dashboard/learning-paths");
    } catch {
      toast.error("Failed to delete learning path");
    }
  }

  async function handleAddLesson(lessonId: string) {
    setAddingLessonId(lessonId);
    try {
      await api.learningPaths.addLessons(id, { lessonId });
      toast.success("Lesson added");
      setAddLessonOpen(false);
      loadPath();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add lesson";
      toast.error(message);
    } finally {
      setAddingLessonId(null);
    }
  }

  async function handleRemoveLesson(lessonId: string) {
    try {
      await api.learningPaths.removeLesson(id, lessonId);
      setDeleteLessonId(null);
      toast.success("Lesson removed from path");
      loadPath();
    } catch {
      toast.error("Failed to remove lesson");
    }
  }

  async function handleMoveLesson(lessonId: string, direction: "up" | "down") {
    if (!path) return;
    const lessons = [...path.lessons];
    const idx = lessons.findIndex((l) => l.id === lessonId);
    if (idx < 0) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= lessons.length) return;

    [lessons[idx], lessons[swapIdx]] = [lessons[swapIdx], lessons[idx]];
    const newOrder = lessons.map((l) => l.id);

    // Optimistic update
    setPath((prev) => prev ? { ...prev, lessons: lessons.map((l, i) => ({ ...l, sortOrder: i })) } : prev);

    try {
      await api.learningPaths.reorderLessons(id, { lessonIds: newOrder });
    } catch {
      // revert on failure
      loadPath();
    }
  }

  // Filter out lessons already in the path
  const linkedIds = new Set(path?.lessons.map((l) => l.id) ?? []);
  const unlinkedLessons = availableLessons.filter((l) => !linkedIds.has(l.id));

  // Filter out courses already in the path
  const linkedCourseIds = new Set(courses.map((c) => c.id));
  const unlinkedCourses = availableCourses.filter((c) => !linkedCourseIds.has(c.id));

  if (academyLoading || loadingPath) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="glass h-40 animate-pulse rounded-xl" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass h-20 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!path) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => router.push("/dashboard/learning-paths")}
          className="mb-3 flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Learning Paths
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
                onClick={() => { setTitleDraft(path.title); setEditingTitle(true); }}
                title="Click to edit"
              >
                {path.title}
              </h1>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                {path.language.toUpperCase()}
              </span>
              <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                {path.cefrLevel}
              </span>
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                {path.lessons.length} lesson{path.lessons.length !== 1 ? "s" : ""}
              </span>
              {path.estimatedHours != null && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {path.estimatedHours}h est.
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={path.status}
              onChange={(e) => handleUpdateStatus(e.target.value)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize ${statusColors[path.status] ?? "border-zinc-200"}`}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
            <button
              onClick={() => setDeletePathOpen(true)}
              className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
              title="Delete learning path"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Description & Metadata */}
      <div className="glass space-y-4 rounded-xl p-5">
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-500">Description</label>
            {!editingDescription && (
              <button
                onClick={() => { setDescriptionDraft(path.description ?? ""); setEditingDescription(true); }}
                className="text-xs text-violet-600 hover:text-violet-500"
              >
                <Pencil className="h-3 w-3 inline mr-1" />Edit
              </button>
            )}
          </div>
          {editingDescription ? (
            <div className="mt-1.5 space-y-2">
              <textarea
                value={descriptionDraft}
                onChange={(e) => setDescriptionDraft(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-violet-500"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button onClick={handleUpdateDescription} className="rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-violet-500">Save</button>
                <button onClick={() => setEditingDescription(false)} className="rounded-lg px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancel</button>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {path.description || "No description set."}
            </p>
          )}
        </div>

        <div className="flex items-center gap-6">
          <div>
            <label className="text-xs font-medium text-zinc-500">Estimated Hours</label>
            {editingHours ? (
              <div className="mt-1 flex items-center gap-2">
                <input
                  value={hoursDraft}
                  onChange={(e) => setHoursDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleUpdateHours(); if (e.key === "Escape") setEditingHours(false); }}
                  type="number"
                  step="0.5"
                  min="0"
                  className="w-20 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  autoFocus
                />
                <button onClick={handleUpdateHours} className="text-emerald-600"><Check className="h-3.5 w-3.5" /></button>
                <button onClick={() => setEditingHours(false)} className="text-zinc-400"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <p
                className="mt-1 cursor-pointer text-sm text-zinc-600 hover:text-violet-600 dark:text-zinc-400"
                onClick={() => { setHoursDraft(path.estimatedHours?.toString() ?? ""); setEditingHours(true); }}
              >
                {path.estimatedHours != null ? `${path.estimatedHours} hours` : "Not set"} <Pencil className="h-3 w-3 inline ml-1 text-zinc-400" />
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-500">Language</label>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {EXERCISE_LANGUAGES.find((l) => l.code === path.language)?.name ?? path.language}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-500">CEFR Level</label>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{path.cefrLevel}</p>
          </div>
        </div>
      </div>

      {/* Lessons Section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Lessons ({path.lessons.length})</h3>
          <button
            onClick={() => setAddLessonOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Lesson
          </button>
        </div>

        {path.lessons.length === 0 ? (
          <div className="glass flex flex-col items-center justify-center rounded-xl py-12 text-center">
            <BookOpen className="mb-3 h-8 w-8 text-zinc-400" />
            <p className="font-medium text-zinc-500">No lessons in this path</p>
            <p className="mt-1 text-sm text-zinc-400">Add existing lessons to build your curriculum</p>
            <button
              onClick={() => setAddLessonOpen(true)}
              className="mt-4 flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" />
              Add Lesson
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {path.lessons.map((lesson, idx) => (
              <div
                key={lesson.id}
                className="glass flex items-center gap-3 rounded-xl p-4"
              >
                {/* Sort order number */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-sm font-bold text-zinc-500 dark:bg-zinc-800">
                  {idx + 1}
                </div>

                {/* Move buttons */}
                <div className="flex shrink-0 flex-col gap-0.5">
                  <button
                    onClick={() => handleMoveLesson(lesson.id, "up")}
                    disabled={idx === 0}
                    className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-20 dark:hover:bg-zinc-800"
                    title="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleMoveLesson(lesson.id, "down")}
                    disabled={idx === path.lessons.length - 1}
                    className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-20 dark:hover:bg-zinc-800"
                    title="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Lesson info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium truncate">{lesson.title}</h4>
                    <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                      {lesson.cefrLevel}
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${lessonStatusColors[lesson.status] ?? "bg-zinc-100 text-zinc-600"}`}>
                      {lesson.status}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-zinc-500">
                    <span>{lesson.exerciseCount} exercise{lesson.exerciseCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => router.push(`/dashboard/lessons/${lesson.id}`)}
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                    title="Edit lesson"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteLessonId(lesson.id)}
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                    title="Remove from path"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Courses Section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Library className="h-5 w-5 text-violet-500" />
            Courses ({courses.length})
          </h3>
          <button
            onClick={() => setAddCourseOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Course
          </button>
        </div>

        {loadingCourses ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass h-20 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="glass flex flex-col items-center justify-center rounded-xl py-12 text-center">
            <Library className="mb-3 h-8 w-8 text-zinc-400" />
            <p className="font-medium text-zinc-500">No courses in this path</p>
            <p className="mt-1 text-sm text-zinc-400">Add existing courses to build your curriculum</p>
            <button
              onClick={() => setAddCourseOpen(true)}
              className="mt-4 flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" />
              Add Course
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {courses.map((course, idx) => (
              <div
                key={course.id}
                className="glass flex items-center gap-3 rounded-xl p-4"
              >
                {/* Sort order number */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-sm font-bold text-zinc-500 dark:bg-zinc-800">
                  {idx + 1}
                </div>

                {/* Move buttons */}
                <div className="flex shrink-0 flex-col gap-0.5">
                  <button
                    onClick={() => handleMoveCourse(course.id, "up")}
                    disabled={idx === 0}
                    className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-20 dark:hover:bg-zinc-800"
                    title="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleMoveCourse(course.id, "down")}
                    disabled={idx === courses.length - 1}
                    className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-20 dark:hover:bg-zinc-800"
                    title="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Course info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium truncate">{course.title}</h4>
                    <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                      {course.cefrLevel}
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[course.status] ?? "bg-zinc-100 text-zinc-600"}`}>
                      {course.status}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-zinc-500">
                    {course.lessonCount != null && (
                      <span>{course.lessonCount} lesson{course.lessonCount !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => router.push(`/dashboard/courses/${course.id}`)}
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                    title="View course"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteCourseId(course.id)}
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                    title="Remove from path"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Lesson Dialog */}
      <Dialog open={addLessonOpen} onOpenChange={setAddLessonOpen}>
        <DialogContent className="sm:max-w-lg max-h-[70vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Lesson to Path</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 py-2">
            {loadingLessons ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                ))}
              </div>
            ) : unlinkedLessons.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500">
                {availableLessons.length === 0 ? "No lessons available. Create lessons first." : "All lessons are already in this path."}
              </div>
            ) : (
              unlinkedLessons.map((lesson) => (
                <button
                  key={lesson.id}
                  onClick={() => handleAddLesson(lesson.id)}
                  disabled={addingLessonId === lesson.id}
                  className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 p-3 text-left transition hover:border-violet-300 hover:bg-violet-50/50 disabled:opacity-50 dark:border-zinc-700 dark:hover:border-violet-600 dark:hover:bg-violet-900/10"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-bold text-white">
                    {lesson.cefrLevel}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{lesson.title}</p>
                    <p className="text-xs text-zinc-500">
                      {lesson.exerciseCount} exercise{lesson.exerciseCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Plus className="h-4 w-4 shrink-0 text-violet-500" />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove lesson confirmation */}
      <AlertDialog open={!!deleteLessonId} onOpenChange={() => setDeleteLessonId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Lesson</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the lesson from this learning path. The lesson itself will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteLessonId && handleRemoveLesson(deleteLessonId)} className="bg-red-600 text-white hover:bg-red-500">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete path confirmation */}
      <AlertDialog open={deletePathOpen} onOpenChange={setDeletePathOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Learning Path</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the learning path. All lessons within will be preserved, only the path structure will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePath} className="bg-red-600 text-white hover:bg-red-500">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Course Dialog */}
      <Dialog open={addCourseOpen} onOpenChange={setAddCourseOpen}>
        <DialogContent className="sm:max-w-lg max-h-[70vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Course to Path</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 py-2">
            {loadingAvailableCourses ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                ))}
              </div>
            ) : unlinkedCourses.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500">
                {availableCourses.length === 0 ? "No courses available. Create courses first." : "All courses are already in this path."}
              </div>
            ) : (
              unlinkedCourses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => handleAddCourse(course.id)}
                  disabled={addingCourseId === course.id}
                  className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 p-3 text-left transition hover:border-violet-300 hover:bg-violet-50/50 disabled:opacity-50 dark:border-zinc-700 dark:hover:border-violet-600 dark:hover:bg-violet-900/10"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-bold text-white">
                    {course.cefrLevel}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{course.title}</p>
                    <p className="text-xs text-zinc-500">
                      {course.lessonCount != null ? `${course.lessonCount} lesson${course.lessonCount !== 1 ? "s" : ""}` : course.status}
                    </p>
                  </div>
                  <Plus className="h-4 w-4 shrink-0 text-violet-500" />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove course confirmation */}
      <AlertDialog open={!!deleteCourseId} onOpenChange={() => setDeleteCourseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Course</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the course from this learning path. The course itself will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteCourseId && handleRemoveCourse(deleteCourseId)} className="bg-red-600 text-white hover:bg-red-500">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
