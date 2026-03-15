"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { JoinForm } from "@/components/room/join-form";
import { RoomView, type RoomSession } from "@/components/room/room-view";
import { createPublicClient } from "@/hooks/use-api-client";
import { ApiError } from "@langopia/api-client";

export default function ClassPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const classId = params.id as string;

  const [session, setSession] = useState<RoomSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const isTeacher = token?.startsWith("t_") ?? false;

  async function handleJoin(name: string, email?: string) {
    setJoining(true);
    setError(null);

    try {
      const api = createPublicClient();
      const data = await api.roomInternal.join({ token: token!, name, email });
      setSession(data as unknown as RoomSession);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Failed to join class");
      } else {
        setError("Failed to connect to the server");
      }
    } finally {
      setJoining(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Invalid Class Link</h1>
          <p className="mt-2 text-zinc-400">This link is missing a valid access token.</p>
        </div>
      </div>
    );
  }

  if (session) {
    return <RoomView session={session} />;
  }

  return (
    <JoinForm
      isTeacher={isTeacher}
      onJoin={handleJoin}
      joining={joining}
      error={error}
    />
  );
}
