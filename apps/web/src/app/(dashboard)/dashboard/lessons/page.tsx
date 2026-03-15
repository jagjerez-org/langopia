"use client";

import { useEffect, useState, useCallback } from "react";
import { BookOpen, Plus, Filter, Pencil, Sparkles } from "lucide-react";
import { EXERCISE_LANGUAGES } from "@langopia/shared/types";
import { useAcademyLevels } from "@/hooks/use-academy-levels";
import { useTokenUsage } from "@/hooks/use-token-usage";
import { useAcademy } from "@/components/academy-provider";
import { useRouter } from "next/navigation";
import { useApiKeyClient } from "@/hooks/use-api-client";
import { LessonWizard } from "@/components/lesson-wizard";
import { PageHeader, PageSkeleton, EmptyState, ListItem, GradientAvatar, PrimaryAction } from "@/components/dashboard-list";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  ready: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  completed: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export default function LessonsPage() {
  const { selectedAcademy, loading: academyLoading } = useAcademy();
  const router = useRouter();
  const api = useApiKeyClient();
  const { levelCodes } = useAcademyLevels();
  const tokenUsage = useTokenUsage();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [total, setTotal] = useState(0);

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

  // Filters
  const [filterLanguage, setFilterLanguage] = useState<string>("all");
  const [filterCefr, setFilterCefr] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const loadLessons = useCallback(async () => {
    try {
      const data = await api.lessons.list({
        language: filterLanguage !== "all" ? filterLanguage : undefined,
        cefrLevel: filterCefr !== "all" ? filterCefr : undefined,
        status: filterStatus !== "all" ? filterStatus : undefined,
        limit: 100,
      });
      setLessons((data.data ?? []) as unknown as Lesson[]);
      setTotal(data.total ?? 0);
    } catch {
      // ignore
    }
  }, [api, filterLanguage, filterCefr, filterStatus]);

  useEffect(() => {
    setLessons([]);
    setTotal(0);
    if (selectedAcademy) loadLessons();
  }, [selectedAcademy, loadLessons]);

  function handleCreateNew() {
    setEditingLesson(null);
    setWizardOpen(true);
  }

  function handleEditLesson(lesson: Lesson, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingLesson(lesson);
    setWizardOpen(true);
  }

  const hasActiveFilters = filterLanguage !== "all" || filterCefr !== "all" || filterStatus !== "all";

  // Group by language
  const grouped = new Map<string, Lesson[]>();
  for (const lesson of lessons) {
    const lang = EXERCISE_LANGUAGES.find((l) => l.code === lesson.language)?.name ?? lesson.language;
    if (!grouped.has(lang)) grouped.set(lang, []);
    grouped.get(lang)!.push(lesson);
  }

  if (academyLoading) {
    return <PageSkeleton />;
  }

  if (!selectedAcademy) {
    return (
      <div className="mx-auto max-w-6xl">
        <EmptyState icon={BookOpen} title="No academy selected" description="Select an academy from the sidebar to view lessons" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <PageHeader
        title="Lessons"
        subtitle={`${lessons.length} of ${total} lesson${total !== 1 ? "s" : ""}`}
        extra={
          !tokenUsage.loading ? (
            <p className={`mt-1 text-xs font-medium ${tokenUsage.limit > 0 && tokenUsage.used / tokenUsage.limit > 0.8 ? "text-red-500" : "text-pink-500 dark:text-pink-400"}`}>
              <Sparkles className="mr-1 inline h-3 w-3" />
              AI Tokens: {tokenUsage.formatted}
            </p>
          ) : undefined
        }
        action={
          <PrimaryAction onClick={handleCreateNew}>
            <Plus className="mr-2 h-4 w-4" /> Create Lesson
          </PrimaryAction>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-zinc-400" />
        <Select value={filterLanguage} onValueChange={setFilterLanguage}>
          <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs">
            <SelectValue placeholder="All languages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All languages</SelectItem>
            {EXERCISE_LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>
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
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-auto min-w-[100px] text-xs">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <button
            onClick={() => { setFilterLanguage("all"); setFilterCefr("all"); setFilterStatus("all"); }}
            className="text-xs text-violet-600 hover:text-violet-500"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Lessons list */}
      {lessons.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No lessons yet"
          description="Create your first lesson to get started"
          action={
            <div className="mt-4">
              <PrimaryAction onClick={handleCreateNew}>
                <Plus className="mr-2 h-4 w-4" /> Create Lesson
              </PrimaryAction>
            </div>
          }
        />
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([language, groupLessons]) => (
            <div key={language}>
              <h2 className="mb-3 text-sm font-semibold text-zinc-500">{language}</h2>
              <div className="space-y-2">
                {groupLessons.map((lesson) => (
                  <ListItem
                    key={lesson.id}
                    onClick={() => router.push(`/dashboard/lessons/${lesson.id}`)}
                    avatar={<GradientAvatar>{lesson.cefrLevel}</GradientAvatar>}
                    title={<h3 className="font-semibold truncate">{lesson.title}</h3>}
                    badges={
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[lesson.status] ?? "bg-zinc-100 text-zinc-600"}`}>
                        {lesson.status}
                      </span>
                    }
                    subtitle={
                      <>
                        <span>{lesson.exerciseCount} exercise{lesson.exerciseCount !== 1 ? "s" : ""}</span>
                        <span>&middot;</span>
                        <span>{new Date(lesson.createdAt).toLocaleDateString()}</span>
                      </>
                    }
                    actions={
                      <button
                        onClick={(e) => handleEditLesson(lesson, e)}
                        className="rounded-md p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                        title="Edit with wizard"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lesson Wizard */}
      <LessonWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        editingLesson={editingLesson ? {
          id: editingLesson.id,
          title: editingLesson.title,
          description: editingLesson.description,
          language: editingLesson.language,
          cefrLevel: editingLesson.cefrLevel,
          status: editingLesson.status,
        } : undefined}
        onComplete={() => {
          loadLessons();
        }}
      />
    </div>
  );
}
