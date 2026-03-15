"use client";

import { useEffect, useState } from "react";
import { getApiClient } from "@/lib/api";
import { BookOpen } from "lucide-react";
import { CourseCard } from "@/components/course-card";
import type { StudentCourse } from "@langopia/api-client";

export default function StudyPage() {
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getApiClient()
      .studentApp.courses()
      .then((data) => setCourses(data || []))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="px-2 py-6 md:px-3">
      <h1 className="font-display text-2xl font-bold mb-5">Mis cursos</h1>

      {courses.length === 0 ? (
        <div className="rounded-2xl bg-muted/50 p-8 text-center animate-fade-in-up">
          <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Tu academia está preparando contenido</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Los cursos aparecerán aquí cuando estén disponibles
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {courses.map((course, i) => (
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
  );
}
