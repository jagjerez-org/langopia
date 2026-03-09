"use client";

import { useEffect, useState, useCallback } from "react";
import { BookOpen, Plus, Filter, ChevronRight, Search } from "lucide-react";
import { EXERCISE_LANGUAGES, CourseStatus } from "@langopia/shared/types";
import { useAcademyLevels } from "@/hooks/use-academy-levels";
import { toast } from "sonner";
import { useAcademy } from "@/components/academy-provider";
import { useRouter } from "next/navigation";
import { useApiClient } from "@/hooks/use-api-client";
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

interface Course {
  id: string;
  title: string;
  description: string | null;
  language: string;
  cefrLevel: string;
  status: string;
  lessonCount?: number;
  estimatedHours: number | null;
  createdAt: string;
  updatedAt: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  archived: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export default function CoursesPage() {
  const { selectedAcademy, loading: academyLoading } = useAcademy();
  const router = useRouter();
  const api = useApiClient();
  const { levelCodes } = useAcademyLevels();
  const [courses, setCourses] = useState<Course[]>([]);
  const [total, setTotal] = useState(0);

  // Create course form
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newLanguage, setNewLanguage] = useState("en");
  const [newCefrLevel, setNewCefrLevel] = useState("B1");
  const [newDescription, setNewDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterLanguage, setFilterLanguage] = useState<string>("all");
  const [filterCefr, setFilterCefr] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  const loadCourses = useCallback(async () => {
    if (!selectedAcademy) return;
    try {
      const data = await api.courses.list(selectedAcademy, {
        language: filterLanguage !== "all" ? filterLanguage : undefined,
        cefrLevel: filterCefr !== "all" ? filterCefr : undefined,
        status: filterStatus !== "all" ? filterStatus : undefined,
        search: search.trim() || undefined,
        limit: 100,
      });
      setCourses((data.data ?? []) as unknown as Course[]);
      setTotal(data.total ?? 0);
    } catch {
      // ignore
    }
  }, [api, selectedAcademy, filterLanguage, filterCefr, filterStatus, search]);

  useEffect(() => {
    setCourses([]);
    setTotal(0);
    if (selectedAcademy) loadCourses();
  }, [selectedAcademy, loadCourses]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAcademy || !newTitle.trim()) return;

    setSaving(true);
    try {
      const course = await api.courses.create(selectedAcademy, {
        title: newTitle,
        language: newLanguage,
        cefrLevel: newCefrLevel,
        description: newDescription || undefined,
      });
      setCreating(false);
      setNewTitle("");
      setNewDescription("");
      toast.success("Course created");
      router.push(`/dashboard/courses/${course.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create course";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const hasActiveFilters =
    filterLanguage !== "all" || filterCefr !== "all" || filterStatus !== "all" || search.trim() !== "";

  if (academyLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-8 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass h-24 animate-pulse rounded-xl" />
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
          <p className="mt-1 text-sm text-zinc-400">Select an academy from the sidebar to view courses</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Courses</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage your academy courses and their lesson structure
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-gradient-accent text-white">
          <Plus className="mr-2 h-4 w-4" /> New Course
        </Button>
      </div>

      {/* Create course form */}
      {creating && (
        <form onSubmit={handleCreate} className="glass-strong space-y-4 rounded-xl p-5">
          <h3 className="font-semibold">Create New Course</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-zinc-500">Title *</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Business English Fundamentals"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500">Language</label>
              <Select value={newLanguage} onValueChange={setNewLanguage}>
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
              <label className="text-xs font-medium text-zinc-500">CEFR Level *</label>
              <Select value={newCefrLevel} onValueChange={setNewCefrLevel}>
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
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-zinc-500">Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional course description..."
                rows={2}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-violet-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={saving || !newTitle.trim()} className="bg-gradient-accent text-white">
              {saving ? "Creating..." : "Create Course"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-zinc-400" />
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses..."
            className="h-8 w-48 pl-8 text-xs"
          />
        </div>
        <Select value={filterLanguage} onValueChange={setFilterLanguage}>
          <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs">
            <SelectValue placeholder="All languages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All languages</SelectItem>
            {EXERCISE_LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCefr} onValueChange={setFilterCefr}>
          <SelectTrigger className="h-8 w-auto min-w-[100px] text-xs">
            <SelectValue placeholder="All levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            {levelCodes.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-auto min-w-[100px] text-xs">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value={CourseStatus.DRAFT}>Draft</SelectItem>
            <SelectItem value={CourseStatus.PUBLISHED}>Published</SelectItem>
            <SelectItem value={CourseStatus.ARCHIVED}>Archived</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <button
            onClick={() => {
              setFilterLanguage("all");
              setFilterCefr("all");
              setFilterStatus("all");
              setSearch("");
            }}
            className="text-xs text-violet-600 hover:text-violet-500"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-zinc-400">
          {courses.length} of {total} course{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Courses list */}
      {courses.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center rounded-xl py-16 text-center">
          <BookOpen className="mb-3 h-10 w-10 text-zinc-400" />
          <p className="font-medium text-zinc-500">No courses yet</p>
          <p className="mt-1 text-sm text-zinc-400">Create your first course to get started</p>
          <Button onClick={() => setCreating(true)} className="mt-4 bg-gradient-accent text-white">
            <Plus className="mr-2 h-4 w-4" /> New Course
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const langName =
              EXERCISE_LANGUAGES.find((l) => l.code === course.language)?.name ?? course.language;
            return (
              <div
                key={course.id}
                onClick={() => router.push(`/dashboard/courses/${course.id}`)}
                className="glass-subtle rounded-xl border border-zinc-200/40 p-4 transition-all hover:shadow-md dark:border-zinc-700/40 cursor-pointer"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-bold text-white">
                    {course.cefrLevel}
                  </div>
                  <Badge
                    variant="secondary"
                    className={`shrink-0 capitalize ${statusColors[course.status] ?? "bg-zinc-100 text-zinc-600"}`}
                  >
                    {course.status}
                  </Badge>
                </div>
                <h3 className="font-semibold leading-snug line-clamp-2">{course.title}</h3>
                {course.description && (
                  <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{course.description}</p>
                )}
                <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
                  <span>{langName}</span>
                  <span>&middot;</span>
                  <span>
                    {course.lessonCount ?? 0} lesson{(course.lessonCount ?? 0) !== 1 ? "s" : ""}
                  </span>
                  {course.estimatedHours && (
                    <>
                      <span>&middot;</span>
                      <span>{course.estimatedHours}h</span>
                    </>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">
                    {new Date(course.createdAt).toLocaleDateString()}
                  </span>
                  <ChevronRight className="h-4 w-4 text-zinc-400" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
