"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getApiClient } from "@/lib/api";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { CourseCard } from "@/components/course-card";
import type { StudentCourse } from "@langopia/api-client";

export default function ExplorePage() {
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);

  useEffect(() => {
    getApiClient()
      .studentApp.exploreCourses()
      .then((data) => setCourses(data || []))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, []);

  const levels = useMemo(() => {
    const set = new Set<string>();
    for (const c of courses) {
      if (c.level) set.add(c.level);
    }
    return Array.from(set).sort();
  }, [courses]);

  const filtered = levelFilter
    ? courses.filter((c) => c.level === levelFilter)
    : courses;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="px-2 py-6 md:px-3">
      <h1 className="font-display text-2xl font-bold">Explorar</h1>
      <p className="mt-1 text-sm text-muted-foreground">Descubre cursos nuevos para ti</p>

      {/* Filter pills */}
      {levels.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
          <button
            onClick={() => setLevelFilter(null)}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
              !levelFilter
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80",
            )}
          >
            Todos
          </button>
          {levels.map((level) => (
            <button
              key={level}
              onClick={() => setLevelFilter(level === levelFilter ? null : level)}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
                levelFilter === level
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80",
              )}
            >
              {level}
            </button>
          ))}
        </div>
      )}

      {/* Course grid */}
      <div className="mt-5">
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-muted/50 p-8 text-center animate-fade-in-up">
            <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Tu academia está preparando contenido</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Los cursos aparecerán aquí cuando estén disponibles
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filtered.map((course, i) => (
              <div
                key={course.id}
                className="animate-fade-in-up"
                style={{ "--stagger": i } as React.CSSProperties}
              >
                <CourseCard
                  id={course.id}
                  title={course.title}
                  description={course.description}
                  level={course.level}
                  language={course.language}
                  completedLessons={course.completedLessons}
                  totalLessons={course.totalLessons}
                  status={course.status}
                  index={i}
                  variant="compact"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
