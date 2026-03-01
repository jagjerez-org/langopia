"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LiveKitRoom } from "@livekit/components-react";
import "@livekit/components-styles";
import { RoomView } from "@/components/classroom/room-view";

export default function LiveSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/sessions/${id}/token`, { method: "POST" })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to get token");
        }
        return res.json();
      })
      .then((data) => setToken(data.token))
      .catch((err) => setError(err.message));
  }, [id]);

  const handleDisconnected = useCallback(() => {
    router.push("/classroom");
  }, [router]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-destructive">{error}</p>
          <button
            onClick={() => router.push("/classroom")}
            className="mt-4 text-sm text-muted-foreground underline"
          >
            Back to classrooms
          </button>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Connecting to session...</p>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      connect={true}
      onDisconnected={handleDisconnected}
      className="h-full"
    >
      <RoomView />
    </LiveKitRoom>
  );
}
