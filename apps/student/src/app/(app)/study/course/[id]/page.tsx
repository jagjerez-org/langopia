"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getApiClient } from "@/lib/api";
import { ChevronLeft, Lock, CheckCircle, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressRing } from "@/components/progress-ring";
import type { StudentCourseDetail } from "@langopia/api-client";

const COURSE_COLORS = [
  "from-course-coral to-course-coral/80",
  "from-course-teal to-course-teal/80",
  "from-course-violet to-course-violet/80",
  "from-course-amber to-course-amber/80",
  "from-course-sky to-course-sky/80",
];

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<StudentCourseDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getApiClient()
      .studentApp.courseDetail(id)
      .then((data) => setCourse(data || null))
      .catch(() => setCourse(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !course) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const totalCompleted = course.lessons.filter((l) => l.status === "completed").length;
  const overallProgress = course.lessons.length > 0
    ? Math.round((totalCompleted / course.lessons.length) * 100)
    : 0;

  // Deterministic color from id hash
  const colorIndex = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % COURSE_COLORS.length;

  // Group by module
  const modules = new Map<string, typeof course.lessons>();
  for (const lesson of course.lessons) {
    const key = lesson.module || "Lecciones";
    if (!modules.has(key)) modules.set(key, []);
    modules.get(key)!.push(lesson);
  }

  return (
    <div className="px-2 py-6 md:px-3">
      <Link
        href="/study"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Atrás
      </Link>

      {/* Course header banner */}
      <div className={cn(
        "rounded-2xl bg-gradient-to-br p-5 text-white mb-6",
        COURSE_COLORS[colorIndex],
      )}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold">{course.title}</h1>
            {course.description && (
              <p className="mt-1 text-sm opacity-80">{course.description}</p>
            )}
            <div className="mt-3 flex items-center gap-3">
              {course.level && (
                <span className="rounded-full bg-white/20 px-3 py-0.5 text-xs font-medium">
                  {course.level}
                </span>
              )}
              <span className="text-xs opacity-80">
                {totalCompleted}/{course.lessons.length} lecciones
              </span>
            </div>
          </div>
          <ProgressRing progress={overallProgress} size={48} strokeWidth={4} />
        </div>
      </div>

      {/* Lessons timeline */}
      <div className="space-y-6">
        {Array.from(modules.entries()).map(([moduleName, lessons]) => (
          <div key={moduleName} className="animate-fade-in-up">
            <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {moduleName}
            </h2>
            <div className="relative ml-4">
              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />

              {lessons.map((lesson, i) => {
                const isCompleted = lesson.status === "completed";
                const isInProgress = lesson.status === "in_progress";
                const prevCompleted = i === 0 || lessons[i - 1].status === "completed";
                const isLocked = lesson.status === "not_started" && !prevCompleted;
                const progress =
                  lesson.totalExercises > 0
                    ? Math.round((lesson.completedExercises / lesson.totalExercises) * 100)
                    : 0;

                return (
                  <Link
                    key={lesson.id}
                    href={isLocked ? "#" : `/study/lesson/${lesson.id}`}
                    onClick={(e) => isLocked && e.preventDefault()}
                    className={cn(
                      "relative flex items-center gap-3 py-3 pl-8 pr-3 rounded-xl transition-colors",
                      isLocked ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/50",
                    )}
                  >
                    <div
                      className={cn(
                        "absolute left-0 flex h-6 w-6 items-center justify-center rounded-full border-2",
                        isCompleted && "border-green-500 bg-green-500 text-white",
                        isInProgress && "border-primary bg-primary text-white",
                        !isCompleted && !isInProgress && "border-border bg-card",
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-3.5 w-3.5" />
                      ) : isLocked ? (
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      ) : isInProgress ? (
                        <Play className="h-3 w-3" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        "text-sm font-medium",
                        isCompleted && "text-muted-foreground",
                      )}>
                        {lesson.title}
                      </div>
                      {isInProgress && (
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-secondary max-w-[120px]">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {lesson.completedExercises}/{lesson.totalExercises}
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
