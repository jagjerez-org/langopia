"use client";

import { useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RegenerateDialogProps {
  exerciseId: string;
  exerciseType: string;
  exerciseTargetSkill: string;
  exerciseInstruction: string;
  apiKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegenerated: (newExercise: Record<string, unknown>) => void;
}

export function RegenerateDialog({
  exerciseId,
  exerciseType,
  exerciseTargetSkill,
  exerciseInstruction,
  apiKey,
  open,
  onOpenChange,
  onRegenerated,
}: RegenerateDialogProps) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [regenerating, setRegenerating] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setCustomPrompt("");
      setRegenerating(false);
    }
    onOpenChange(nextOpen);
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/v1/exercises/${exerciseId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customPrompt: customPrompt.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to regenerate exercise");
        return;
      }

      const newExercise = await res.json();
      toast.success("Exercise regenerated");
      onRegenerated(newExercise);
      handleOpenChange(false);
    } catch {
      toast.error("Failed to regenerate exercise");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-violet-500" />
            Regenerate Exercise
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Exercise info */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-800/30">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {exerciseType.replace(/_/g, " ")}
              </span>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                {exerciseTargetSkill}
              </span>
            </div>
            <p className="text-sm text-zinc-600 line-clamp-2 dark:text-zinc-400">
              {exerciseInstruction}
            </p>
          </div>

          {/* Custom prompt */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500">
              Additional instructions (optional)
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Make it about food vocabulary, add more distractors, make it harder..."
              rows={3}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-zinc-400 focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-800 dark:placeholder:text-zinc-500 dark:focus:border-violet-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => handleOpenChange(false)}
              disabled={regenerating}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              {regenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" /> Regenerate
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
