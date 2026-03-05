"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useJwtClient } from "@/hooks/use-jwt-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Users,
  Globe,
  BookOpen,
  Video,
} from "lucide-react";
import type { MyClassDetail } from "@langopia/api-client";

export default function AppClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const api = useJwtClient();
  const [cls, setCls] = useState<MyClassDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me
      .classDetail(id)
      .then(setCls)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api, id]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (!cls) {
    return (
      <div className="space-y-4">
        <Link href="/app/classes" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-zinc-900 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <p className="text-center text-muted-foreground">Class not found</p>
      </div>
    );
  }

  const canEnter = cls.status === "scheduled" || cls.status === "confirmed" || cls.status === "in_progress";

  return (
    <div className="space-y-5">
      <Link href="/app/classes" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-zinc-900 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to classes
      </Link>

      <div className="glass rounded-2xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{cls.title}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {cls.academyName}
            </p>
          </div>
          <Badge variant="secondary">{cls.status}</Badge>
        </div>

        {cls.description && (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            {cls.description}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <InfoItem icon={CalendarDays} label="Scheduled">
            {new Date(cls.scheduledAt).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </InfoItem>
          <InfoItem icon={Clock} label="Duration">
            {cls.durationMinutes} minutes
          </InfoItem>
          <InfoItem icon={Globe} label="Language">
            {cls.language.toUpperCase()}
          </InfoItem>
          <InfoItem icon={Users} label="Type">
            {cls.classType} (max {cls.maxStudents})
          </InfoItem>
        </div>

        {cls.lesson && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Lesson:</span>
            <span className="font-medium">{cls.lesson.title}</span>
          </div>
        )}

        {canEnter && (
          <Button asChild className="mt-5 w-full" size="lg">
            <Link href={cls.teacherUrl}>
              <Video className="mr-2 h-4 w-4" />
              Enter Classroom
            </Link>
          </Button>
        )}
      </div>

      {/* Students */}
      {cls.students.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <h2 className="mb-3 font-semibold">
            Students ({cls.students.length})
          </h2>
          <div className="space-y-2">
            {cls.students.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/40"
              >
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.email}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {s.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{children}</p>
      </div>
    </div>
  );
}
