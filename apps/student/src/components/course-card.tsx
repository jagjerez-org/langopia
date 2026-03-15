"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { ProgressRing } from "./progress-ring";
import { cn } from "@/lib/utils";

const COURSE_COLORS = [
  { bg: "from-course-coral to-course-coral/80", text: "text-white" },
  { bg: "from-course-teal to-course-teal/80", text: "text-white" },
  { bg: "from-course-violet to-course-violet/80", text: "text-white" },
  { bg: "from-course-amber to-course-amber/80", text: "text-white" },
  { bg: "from-course-sky to-course-sky/80", text: "text-white" },
];

interface CourseCardProps {
  id: string;
  title: string;
  description?: string;
  level?: string;
  language?: string;
  completedLessons: number;
  totalLessons: number;
  status?: string;
  index: number;
  variant?: "large" | "compact";
}

export function CourseCard({
  id,
  title,
  description,
  level,
  completedLessons,
  totalLessons,
  status,
  index,
  variant = "large",
}: CourseCardProps) {
  const colorSet = COURSE_COLORS[index % COURSE_COLORS.length];
  const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const isCompleted = status === "completed";

  if (variant === "compact") {
    return (
      <Link
        href={`/study/course/${id}`}
        className={cn(
          "block rounded-2xl bg-gradient-to-br p-4 shadow-sm transition-shadow hover:shadow-md",
          colorSet.bg,
          colorSet.text,
        )}
      >
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
            <BookOpen className="h-5 w-5" />
          </div>
          {level && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
              {level}
            </span>
          )}
        </div>
        <h3 className="mt-3 font-display text-sm font-bold leading-tight line-clamp-2">{title}</h3>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs opacity-80">
            {completedLessons}/{totalLessons}
          </span>
          <ProgressRing progress={progress} size={28} strokeWidth={2.5} />
        </div>
      </Link>
    );
  }

  // Large variant — tall colorful card for carousel
  return (
    <Link
      href={`/study/course/${id}`}
      className={cn(
        "flex w-[180px] shrink-0 flex-col justify-between rounded-2xl bg-gradient-to-br p-5 shadow-md transition-transform hover:scale-[1.02]",
        colorSet.bg,
        colorSet.text,
        "h-[240px]",
      )}
    >
      <div>
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
            {isCompleted ? (
              <span className="text-lg">✓</span>
            ) : (
              <BookOpen className="h-5 w-5" />
            )}
          </div>
          {level && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
              {level}
            </span>
          )}
        </div>
        <h3 className="mt-4 font-display text-base font-bold leading-tight line-clamp-3">{title}</h3>
        {description && (
          <p className="mt-1 text-xs opacity-70 line-clamp-2">{description}</p>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs opacity-80">
          {completedLessons}/{totalLessons} lessons
        </span>
        <ProgressRing progress={progress} size={32} strokeWidth={3} />
      </div>
    </Link>
  );
}
