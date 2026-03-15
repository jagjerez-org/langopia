"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiClient } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  Flame,
  BookOpen,
  RefreshCw,
  Calendar,
  ArrowRight,
  Zap,
  Play,
  Compass,
  CheckCircle,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CourseCard } from "@/components/course-card";
import { ProgressRing } from "@/components/progress-ring";
import type { StudentHome, StudentCourse, StudentLearningPathResponse } from "@langopia/api-client";

type Tab = "today" | "plan";

const DEFAULT_HOME: StudentHome = {
  streak: { currentStreak: 0, longestStreak: 0, freezesAvailable: 1 },
  today: { exercisesCompleted: 0, minutesPracticed: 0, xpEarned: 0 },
  reviewDueCount: 0,
  dailyGoalMinutes: 15,
  nextClass: null,
  continueLesson: null,
  recommendedCourse: null,
};

function getGreeting(): { greeting: string; subtitle: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { greeting: "¡Buenos días", subtitle: "Empieza tu día con una lección" };
  if (hour < 18) return { greeting: "¡Buenas tardes", subtitle: "¿Listo para practicar?" };
  return { greeting: "¡Buenas noches", subtitle: "Unas lecciones antes de dormir" };
}

export default function HomePage() {
  const { user } = useAuth();
  const [data, setData] = useState<StudentHome | null>(null);
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  const [learningPath, setLearningPath] = useState<StudentLearningPathResponse | null>(null);
  const [tab, setTab] = useState<Tab>("today");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = getApiClient();
    Promise.all([
      client.studentApp.home().catch(() => null),
      client.studentApp.courses().catch(() => null),
    ])
      .then(([home, courseList]) => {
        setData(home || DEFAULT_HOME);
        setCourses(courseList || []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Load learning path when switching to plan tab
  useEffect(() => {
    if (tab !== "plan" || learningPath) return;
    getApiClient()
      .studentApp.learningPath()
      .catch(() => null)
      .then((lp) => {
        setLearningPath(lp || { status: "not_ready", courses: [] });
      });
  }, [tab, learningPath]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const { greeting, subtitle } = getGreeting();
  const firstName = user?.name?.split(" ")[0] || "estudiante";
  const dailyProgress = Math.min(100, ((data?.today.minutesPracticed || 0) / (data?.dailyGoalMinutes || 15)) * 100);

  return (
    <div className="px-2 py-6 md:px-3">
      {/* Greeting */}
      <div className="animate-fade-in-up" style={{ "--stagger": 0 } as React.CSSProperties}>
        <h1 className="font-display text-2xl font-bold text-foreground">
          {greeting}, {firstName}!
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Tab selector */}
      <div className="mt-4 flex gap-2 animate-fade-in-up" style={{ "--stagger": 1 } as React.CSSProperties}>
        {(["today", "plan"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full px-5 py-2 text-sm font-semibold transition-all",
              tab === t
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80",
            )}
          >
            {t === "today" ? "Hoy" : "Plan de estudio"}
          </button>
        ))}
      </div>

      {tab === "today" ? (
        <TodayTab data={data!} courses={courses} dailyProgress={dailyProgress} />
      ) : (
        <PlanTab learningPath={learningPath} />
      )}
    </div>
  );
}

function TodayTab({
  data,
  courses,
  dailyProgress,
}: {
  data: StudentHome;
  courses: StudentCourse[];
  dailyProgress: number;
}) {
  return (
    <div className="mt-5 space-y-5">
      {/* Daily progress bar */}
      <div
        className="animate-fade-in-up rounded-2xl bg-card p-4 shadow-sm"
        style={{ "--stagger": 2 } as React.CSSProperties}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Progreso del día</span>
          <div className="flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-primary">{data.today.xpEarned} XP</span>
          </div>
        </div>
        <div className="h-3 rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500"
            style={{ width: `${dailyProgress}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
          <span>{data.today.minutesPracticed} min</span>
          <span>Meta: {data.dailyGoalMinutes} min</span>
        </div>
      </div>

      {/* Action cards row */}
      <div
        className="grid grid-cols-2 gap-3 animate-fade-in-up"
        style={{ "--stagger": 3 } as React.CSSProperties}
      >
        {/* Continue / Recommended / Explore */}
        {data.continueLesson ? (
          <Link
            href={`/study/lesson/${data.continueLesson.lessonId}`}
            className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-primary to-primary/85 p-4 text-primary-foreground shadow-md transition-transform hover:scale-[1.02] min-h-[120px]"
          >
            <Play className="h-6 w-6" />
            <div>
              <div className="text-xs opacity-80">Continuar</div>
              <div className="mt-0.5 font-display text-sm font-bold leading-tight line-clamp-2">
                {data.continueLesson.title}
              </div>
            </div>
          </Link>
        ) : data.recommendedCourse ? (
          <Link
            href={`/study/course/${data.recommendedCourse.id}`}
            className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-primary to-primary/85 p-4 text-primary-foreground shadow-md transition-transform hover:scale-[1.02] min-h-[120px]"
          >
            <BookOpen className="h-6 w-6" />
            <div>
              <div className="text-xs opacity-80">Recomendado para ti</div>
              <div className="mt-0.5 font-display text-sm font-bold leading-tight line-clamp-2">
                {data.recommendedCourse.title}
              </div>
            </div>
          </Link>
        ) : (
          <Link
            href="/explore"
            className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-primary to-primary/85 p-4 text-primary-foreground shadow-md transition-transform hover:scale-[1.02] min-h-[120px]"
          >
            <Compass className="h-6 w-6" />
            <div>
              <div className="font-display text-sm font-bold">Nueva lección</div>
              <div className="text-xs opacity-80">Empieza algo nuevo</div>
            </div>
          </Link>
        )}

        {/* Review or Next class */}
        {(data.reviewDueCount ?? 0) > 0 ? (
          <Link
            href="/review"
            className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-course-violet to-course-violet/85 p-4 text-white shadow-md transition-transform hover:scale-[1.02] min-h-[120px]"
          >
            <RefreshCw className="h-6 w-6" />
            <div>
              <div className="text-xs opacity-80">{data.reviewDueCount} pendientes</div>
              <div className="mt-0.5 font-display text-sm font-bold">Repaso</div>
            </div>
          </Link>
        ) : data.nextClass ? (
          <Link
            href={`/classes/${data.nextClass.id}`}
            className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-course-teal to-course-teal/85 p-4 text-white shadow-md transition-transform hover:scale-[1.02] min-h-[120px]"
          >
            <Calendar className="h-6 w-6" />
            <div>
              <div className="text-xs opacity-80">Próxima clase</div>
              <div className="mt-0.5 font-display text-sm font-bold leading-tight line-clamp-2">
                {data.nextClass.title}
              </div>
            </div>
          </Link>
        ) : (
          <div className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-course-teal to-course-teal/85 p-4 text-white shadow-md min-h-[120px]">
            <Calendar className="h-6 w-6" />
            <div>
              <div className="font-display text-sm font-bold">Sin clases</div>
              <div className="text-xs opacity-80">Todo al día</div>
            </div>
          </div>
        )}
      </div>

      {/* Next class banner (if exists and review is shown) */}
      {(data.reviewDueCount ?? 0) > 0 && data.nextClass && (
        <Link
          href={`/classes/${data.nextClass.id}`}
          className="animate-fade-in-up flex items-center gap-3 rounded-2xl bg-course-teal/10 p-4 border border-course-teal/20"
          style={{ "--stagger": 4 } as React.CSSProperties}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-course-teal/20">
            <Calendar className="h-5 w-5 text-course-teal" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{data.nextClass.title}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(data.nextClass.scheduledAt).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}

      {/* My Courses section */}
      {courses.length > 0 && (
        <div
          className="animate-fade-in-up"
          style={{ "--stagger": 5 } as React.CSSProperties}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-bold">Mis cursos</h2>
            <Link href="/study" className="text-sm font-medium text-primary hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2">
            {courses.map((course, i) => (
              <CourseCard
                key={course.id}
                id={course.id}
                title={course.title}
                description={course.description}
                level={course.level}
                language={course.language}
                completedLessons={course.completedLessons}
                totalLessons={course.totalLessons}
                status={course.status}
                index={i}
                variant="large"
              />
            ))}
          </div>
        </div>
      )}

      {/* Explore teaser (mobile) */}
      <Link
        href="/explore"
        className="animate-fade-in-up flex items-center justify-between rounded-2xl bg-accent p-4 md:hidden"
        style={{ "--stagger": 6 } as React.CSSProperties}
      >
        <div className="flex items-center gap-3">
          <Compass className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">Descubre más cursos</span>
        </div>
        <ArrowRight className="h-4 w-4 text-primary" />
      </Link>
    </div>
  );
}

function PlanTab({
  learningPath,
}: {
  learningPath: StudentLearningPathResponse | null;
}) {
  if (!learningPath) {
    return (
      <div className="mt-8 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (learningPath.status === "not_ready" || learningPath.courses.length === 0) {
    return (
      <div className="mt-8 animate-fade-in-up rounded-2xl bg-muted/50 p-8 text-center">
        <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="font-display font-semibold">Tu academia está preparando contenido</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Los cursos y lecciones aparecerán aquí cuando estén disponibles
        </p>
      </div>
    );
  }

  // Group courses by CEFR level
  const levelGroups = new Map<string, typeof learningPath.courses>();
  for (const course of learningPath.courses) {
    const key = course.level || "Otros";
    if (!levelGroups.has(key)) levelGroups.set(key, []);
    levelGroups.get(key)!.push(course);
  }

  return (
    <div className="mt-5 space-y-6">
      {Array.from(levelGroups.entries()).map(([level, courses]) => (
        <div key={level} className="animate-fade-in-up">
          <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {level}
          </h3>
          <div className="space-y-3">
            {courses.map((course) => {
              const progress =
                course.totalLessons > 0
                  ? Math.round((course.completedLessons / course.totalLessons) * 100)
                  : 0;

              if (course.isLocked) {
                return (
                  <div
                    key={course.id}
                    className="flex items-center gap-3 rounded-2xl bg-card p-4 opacity-50 cursor-not-allowed"
                  >
                    <Lock className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-muted-foreground truncate">
                        {course.title}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {course.level} · {course.totalLessons} lecciones
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={course.id}
                  href={`/study/course/${course.id}`}
                  className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm transition-transform hover:scale-[1.01]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{course.title}</span>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {course.level}
                      </span>
                    </div>
                    {course.totalLessons > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-secondary max-w-[200px]">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {course.completedLessons}/{course.totalLessons}
                        </span>
                      </div>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

