"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Speaker } from "@langopia/shared/types";

interface TranscriptionSegment {
  id: string;
  speaker: Speaker;
  text: string;
  timestampStart: number;
  timestampEnd: number;
  languageDetected: string | null;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function TranscriptionViewer({ sessionId }: { sessionId: string }) {
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [speakerFilter, setSpeakerFilter] = useState<string>("all");

  useEffect(() => {
    const params = speakerFilter !== "all" ? `?speaker=${speakerFilter}` : "";
    fetch(`/api/sessions/${sessionId}/transcriptions${params}`)
      .then((r) => r.json())
      .then((data) => setSegments(data))
      .catch(() => setSegments([]))
      .finally(() => setLoading(false));
  }, [sessionId, speakerFilter]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading transcription...</p>;
  }

  if (segments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No transcription available for this session.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {segments.length} segment{segments.length !== 1 ? "s" : ""}
        </p>
        <Select value={speakerFilter} onValueChange={setSpeakerFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Filter speaker" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All speakers</SelectItem>
            <SelectItem value="teacher">Teacher</SelectItem>
            <SelectItem value="student">Student</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="h-[500px] rounded-md border p-4">
        <div className="space-y-3">
          {segments.map((seg) => (
            <div key={seg.id} className="flex gap-3">
              <span className="shrink-0 pt-0.5 text-xs font-mono text-muted-foreground">
                {formatTimestamp(seg.timestampStart)}
              </span>
              <div className="space-y-1">
                <Badge
                  variant="outline"
                  className={
                    seg.speaker === Speaker.TEACHER
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      : "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                  }
                >
                  {seg.speaker === Speaker.TEACHER ? "Teacher" : "Student"}
                </Badge>
                <p className="text-sm leading-relaxed">{seg.text}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
