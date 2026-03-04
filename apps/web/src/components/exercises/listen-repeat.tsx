"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Play, RotateCcw } from "lucide-react";
import type { ExerciseData } from "./exercise-renderer";

interface Props {
  exercise: ExerciseData;
  mode: "preview" | "interactive";
}

export function ListenRepeat({ exercise, mode }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      // Microphone access denied or unavailable
    }
  };

  const handleStopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleReset = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setIsRecording(false);
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
        <Mic className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">Listen & Repeat</span>
      </div>
      {exercise.title && <h4 className="font-semibold text-sm">{exercise.title}</h4>}
      <p className="text-sm text-muted-foreground">{exercise.instruction}</p>

      {/* Model audio */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Listen:</p>
        {exercise.audioUrl ? (
          <audio controls src={exercise.audioUrl} className="w-full h-8" />
        ) : (
          <div className="rounded-md bg-muted p-3 text-sm">
            <Play className="inline h-3 w-3 mr-1" />
            &ldquo;{exercise.content}&rdquo;
          </div>
        )}
      </div>

      {mode === "interactive" && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Your recording:</p>
          {!recordedUrl ? (
            <Button
              size="sm"
              variant={isRecording ? "destructive" : "default"}
              onClick={isRecording ? handleStopRecording : handleStartRecording}
            >
              {isRecording ? (
                <><Square className="mr-1 h-3 w-3" /> Stop Recording</>
              ) : (
                <><Mic className="mr-1 h-3 w-3" /> Start Recording</>
              )}
            </Button>
          ) : (
            <>
              <audio controls src={recordedUrl} className="w-full h-8" />
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="mr-1 h-3 w-3" /> Record Again
              </Button>
            </>
          )}
        </div>
      )}

      {exercise.explanation && (
        <p className="text-xs text-muted-foreground">{exercise.explanation}</p>
      )}
    </div>
  );
}
