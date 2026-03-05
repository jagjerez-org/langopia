"use client";

import { useEffect, useState } from "react";
import { Video, ExternalLink, Copy, Check } from "lucide-react";
import { useAcademy } from "@/components/academy-provider";
import { useApiKeyClient } from "@/hooks/use-api-client";

interface Room {
  id: string;
  title: string;
  language: string;
  maxStudents: number;
  teacherUrl: string;
  studentUrl: string;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

export default function RoomsPage() {
  const { selectedAcademy, selectedAcademyData, loading } = useAcademy();
  const api = useApiKeyClient();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [total, setTotal] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setRooms([]);
    setTotal(0);
    if (!selectedAcademy || !selectedAcademyData?.apiKey) return;

    api.rooms.list()
      .then((result) => {
        setRooms(result.data as unknown as Room[]);
        setTotal(result.total ?? 0);
      })
      .catch(() => {});
  }, [selectedAcademy, selectedAcademyData, api]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-8 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass h-24 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!selectedAcademy) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="glass flex flex-col items-center justify-center rounded-xl py-16 text-center">
          <Video className="mb-3 h-10 w-10 text-zinc-400" />
          <p className="font-medium text-zinc-500">No academy selected</p>
          <p className="mt-1 text-sm text-zinc-400">Select an academy from the sidebar to view rooms</p>
        </div>
      </div>
    );
  }

  function copyUrl(id: string, url: string) {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const statusColors: Record<string, string> = {
    waiting: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    completed: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rooms</h1>
        <p className="text-sm text-zinc-500">{total} total rooms</p>
      </div>

      <div className="space-y-3">
        {rooms.map((room) => (
          <div key={room.id} className="glass rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
                  <Video className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold">{room.title}</h3>
                  <p className="text-xs text-zinc-500">
                    {room.language.toUpperCase()} &middot; Max {room.maxStudents} students
                    &middot; {new Date(room.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                  statusColors[room.status] ?? statusColors.waiting
                }`}
              >
                {room.status}
              </span>
            </div>

            {(room.status === "waiting" || room.status === "active") && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
                  <span className="text-xs font-medium text-zinc-500">Teacher:</span>
                  <code className="flex-1 truncate text-xs text-violet-600 dark:text-violet-400">
                    {room.teacherUrl}
                  </code>
                  <button
                    onClick={() => copyUrl(`t-${room.id}`, room.teacherUrl)}
                    className="shrink-0 rounded p-1 text-zinc-400 hover:text-zinc-600"
                  >
                    {copiedId === `t-${room.id}` ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
                  <span className="text-xs font-medium text-zinc-500">Student:</span>
                  <code className="flex-1 truncate text-xs text-emerald-600 dark:text-emerald-400">
                    {room.studentUrl}
                  </code>
                  <button
                    onClick={() => copyUrl(`s-${room.id}`, room.studentUrl)}
                    className="shrink-0 rounded p-1 text-zinc-400 hover:text-zinc-600"
                  >
                    {copiedId === `s-${room.id}` ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {rooms.length === 0 && (
          <div className="glass flex flex-col items-center justify-center rounded-xl py-16 text-center">
            <Video className="mb-3 h-10 w-10 text-zinc-400" />
            <p className="font-medium text-zinc-500">No rooms yet</p>
            <p className="mt-1 text-sm text-zinc-400">
              Create rooms via the API to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
