"use client";

import { useEffect, useState, useCallback } from "react";
import { History, RotateCcw, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useApiKeyClient } from "@/hooks/use-api-client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface VersionSummary {
  id: string;
  lessonId: string;
  version: number;
  title: string;
  status: string;
  createdAt: string;
}

interface LessonVersionHistoryProps {
  lessonId: string;
  onRestore?: () => void;
}

const statusColors: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  ready: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  completed: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export function LessonVersionHistory({ lessonId, onRestore }: LessonVersionHistoryProps) {
  const api = useApiKeyClient();
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<VersionSummary | null>(null);

  const loadVersions = useCallback(async () => {
    try {
      const result = await api.lessons.listVersions(lessonId);
      setVersions((result.data ?? []) as unknown as VersionSummary[]);
    } catch {
      // ignore
    }
  }, [api, lessonId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  async function handleRestore(version: VersionSummary) {
    setRestoring(version.id);
    try {
      await api.lessons.restoreVersion(lessonId, version.id);
      toast.success(`Restored to version ${version.version}`);
      setConfirmRestore(null);
      onRestore?.();
    } catch {
      toast.error("Failed to restore version");
    } finally {
      setRestoring(null);
    }
  }

  if (versions.length === 0) return null;

  return (
    <div className="glass rounded-xl">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4"
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-semibold">Version History</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {versions.length}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-zinc-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        )}
      </button>

      {expanded && (
        <div className="space-y-1 border-t border-zinc-200/60 px-4 pb-4 pt-2 dark:border-zinc-700/60">
          {versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between rounded-lg px-3 py-2 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-500">v{v.version}</span>
                  <span className="truncate text-sm font-medium">{v.title}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      statusColors[v.status] ?? "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {v.status}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {new Date(v.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setConfirmRestore(v)}
                disabled={!!restoring}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-violet-600 transition hover:bg-violet-50 disabled:opacity-50 dark:text-violet-400 dark:hover:bg-violet-900/20"
              >
                {restoring === v.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                Restore
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Confirm restore dialog */}
      <AlertDialog open={!!confirmRestore} onOpenChange={() => setConfirmRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Version {confirmRestore?.version}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace the current lesson content and exercises with the snapshot from version {confirmRestore?.version}.
              Current exercises will be unlinked and new copies created from the snapshot.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRestore && handleRestore(confirmRestore)}
              className="bg-violet-600 text-white hover:bg-violet-500"
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
