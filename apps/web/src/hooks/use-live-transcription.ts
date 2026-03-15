"use client";

import { useEffect, useRef, useCallback } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import type { LangopiaClient } from "@langopia/api-client";

interface UseLiveTranscriptionOptions {
  roomId: string;
  role: "teacher" | "student";
  participantId: string;
  api: LangopiaClient;
  enabled?: boolean;
}

/**
 * Captures student audio in 10-second chunks and sends to the server
 * for live transcription via Whisper. Only active for students.
 */
export function useLiveTranscription({
  roomId,
  role,
  participantId,
  api,
  enabled = true,
}: UseLiveTranscriptionOptions) {
  const { localParticipant } = useLocalParticipant();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastSentRef = useRef(0);

  const sendChunk = useCallback(
    async (blob: Blob) => {
      // Rate limit: max 6 req/min (one every 10s)
      const now = Date.now();
      if (now - lastSentRef.current < 9000) return;
      lastSentRef.current = now;

      if (blob.size < 1000) return; // Skip very small chunks (silence)

      const formData = new FormData();
      formData.append(
        "audio",
        new File([blob], "chunk.webm", { type: "audio/webm;codecs=opus" }),
      );
      formData.append("participantId", participantId);
      formData.append("participantRole", role);

      try {
        await api.roomInternal.transcribeChunk(roomId, formData);
      } catch {
        // Silently ignore transcription failures
      }
    },
    [roomId, participantId, role, api],
  );

  useEffect(() => {
    // Only transcribe student audio
    if (role !== "student" || !enabled) return;

    const micTrack = localParticipant?.getTrackPublication(
      "microphone" as any,
    );
    if (!micTrack?.track?.mediaStreamTrack) return;

    const stream = new MediaStream([micTrack.track.mediaStreamTrack]);
    streamRef.current = stream;

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        sendChunk(e.data);
      }
    };

    recorder.start(10000); // 10-second chunks

    return () => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
      recorderRef.current = null;
      streamRef.current = null;
    };
  }, [localParticipant, role, enabled, sendChunk]);
}
