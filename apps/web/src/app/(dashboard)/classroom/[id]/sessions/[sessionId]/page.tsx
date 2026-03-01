"use client";

import { useEffect, useState, use } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SessionStatusBadge } from "@/components/classroom/session-status-badge";
import { TranscriptionViewer } from "@/components/classroom/transcription-viewer";
import { ClassReportViewer } from "@/components/classroom/class-report-viewer";
import { SessionStatus } from "@langopia/shared/types";

interface SessionData {
  id: string;
  scheduledAt: string;
  startedAt: string | null;
  endedAt: string | null;
  status: SessionStatus;
  recordingUrl: string | null;
  livekitRoomId: string | null;
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id: classroomId, sessionId } = use(params);
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.json())
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  if (!session) {
    return <div className="text-muted-foreground">Session not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <a
          href={`/classroom/${classroomId}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          &larr; Back to classroom
        </a>
        <h1 className="mt-2 text-2xl font-bold">Session Details</h1>
      </div>

      {/* Session Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            Session Info
            <SessionStatusBadge status={session.status} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="font-medium">Scheduled:</span>{" "}
            {new Date(session.scheduledAt).toLocaleString()}
          </p>
          {session.startedAt && (
            <p>
              <span className="font-medium">Started:</span>{" "}
              {new Date(session.startedAt).toLocaleString()}
            </p>
          )}
          {session.endedAt && (
            <p>
              <span className="font-medium">Ended:</span>{" "}
              {new Date(session.endedAt).toLocaleString()}
            </p>
          )}
          {session.startedAt && session.endedAt && (
            <p>
              <span className="font-medium">Duration:</span>{" "}
              {formatDuration(session.startedAt, session.endedAt)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recording Playback */}
      {session.recordingUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Recording</CardTitle>
          </CardHeader>
          <CardContent>
            <video
              src={session.recordingUrl}
              controls
              className="w-full max-w-2xl rounded-md"
            >
              Your browser does not support the video element.
            </video>
          </CardContent>
        </Card>
      )}

      {/* AI Class Report */}
      {session.status === SessionStatus.COMPLETED && (
        <Card>
          <CardHeader>
            <CardTitle>AI Class Report</CardTitle>
          </CardHeader>
          <CardContent>
            <ClassReportViewer sessionId={sessionId} />
          </CardContent>
        </Card>
      )}

      {/* Transcription */}
      {session.status === SessionStatus.COMPLETED && (
        <Card>
          <CardHeader>
            <CardTitle>Transcription</CardTitle>
          </CardHeader>
          <CardContent>
            <TranscriptionViewer sessionId={sessionId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
