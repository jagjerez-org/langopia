"use client";

import { useEffect, useState, useCallback } from "react";
import { BookOpen, Plus, Filter, Search } from "lucide-react";
import { PageHeader, PageSkeleton, EmptyState, ListItem, GradientAvatar, PrimaryAction } from "@/components/dashboard-list";
import { EXERCISE_LANGUAGES, CourseStatus } from "@langopia/shared/types";
import { useAcademyLevels } from "@/hooks/use-academy-levels";
import { useAcademy } from "@/components/academy-provider";
import { useRouter } from "next/navigation";
import { useApiClient } from "@/hooks/use-api-client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CourseWizard } from "@/components/course-wizard";

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

const STATUS_COLORS: Record<string, string> = {
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

  // Wizard
  const [wizardOpen, setWizardOpen] = useState(false);

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

  const hasActiveFilters =
    filterLanguage !== "all" || filterCefr !== "all" || filterStatus !== "all" || search.trim() !== "";

  if (academyLoading) {
    return <PageSkeleton />;
  }

  if (!selectedAcademy) {
    return (
      <div className="mx-auto max-w-6xl">
        <EmptyState icon={BookOpen} title="No academy selected" description="Select an academy from the sidebar to view courses" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <PageHeader
        title="Courses"
        subtitle="Manage your academy courses and their lesson structure"
        action={
          <PrimaryAction onClick={() => setWizardOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Course
          </PrimaryAction>
        }
      />

      {/* Course Wizard */}
      <CourseWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onComplete={loadCourses}
      />

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
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          description="Create your first course to get started"
          action={
            <div className="mt-4">
              <PrimaryAction onClick={() => setWizardOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> New Course
              </PrimaryAction>
            </div>
          }
        />
      ) : (
        <div className="space-y-3">
          {courses.map((course) => {
            const langName =
              EXERCISE_LANGUAGES.find((l) => l.code === course.language)?.name ?? course.language;
            return (
              <ListItem
                key={course.id}
                onClick={() => router.push(`/dashboard/courses/${course.id}`)}
                avatar={<GradientAvatar>{course.cefrLevel}</GradientAvatar>}
                title={<h3 className="font-semibold truncate">{course.title}</h3>}
                badges={
                  <Badge
                    variant="secondary"
                    className={`shrink-0 capitalize ${STATUS_COLORS[course.status] ?? "bg-zinc-100 text-zinc-600"}`}
                  >
                    {course.status}
                  </Badge>
                }
                subtitle={
                  <>
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
                    <span>&middot;</span>
                    <span>{new Date(course.createdAt).toLocaleDateString()}</span>
                  </>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
