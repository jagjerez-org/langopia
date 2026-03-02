"use client";

import { useState } from "react";
import { Key, Copy, Check, RefreshCw, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAcademy } from "@/components/academy-provider";
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

export default function ApiKeysPage() {
  const { selectedAcademy, selectedAcademyData, loading, refetchAcademies } =
    useAcademy();
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function regenerateKey() {
    if (!selectedAcademy) return;

    const res = await fetch(`/api/academies/${selectedAcademy}`, {
      method: "POST",
    });
    if (res.ok) {
      await refetchAcademies();
      toast.success("API key regenerated successfully");
    } else {
      toast.error("Failed to regenerate API key");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="h-8 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="glass h-32 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!selectedAcademy) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="glass flex flex-col items-center justify-center rounded-xl py-16 text-center">
          <Key className="mb-3 h-10 w-10 text-zinc-400" />
          <p className="font-medium text-zinc-500">No academy selected</p>
          <p className="mt-1 text-sm text-zinc-400">Select an academy from the sidebar to view API keys</p>
        </div>
      </div>
    );
  }

  const apiKey = selectedAcademyData?.apiKey;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="text-sm text-zinc-500">
          Manage the API key for{" "}
          <span className="font-medium">
            {selectedAcademyData?.name ?? "your academy"}
          </span>
          . Use this key to create rooms via the REST API.
        </p>
      </div>

      <div className="glass rounded-xl p-4">
        <h3 className="mb-2 text-sm font-semibold">Quick Start</h3>
        <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-xs text-zinc-300">
          <code>{`curl -X POST https://your-domain.com/api/v1/rooms \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "English Class", "language": "en", "maxStudents": 4}'`}</code>
        </pre>
      </div>

      {apiKey ? (
        <div className="glass rounded-xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                <Key className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold">
                  {selectedAcademyData?.name}
                </h3>
                <p className="text-xs capitalize text-zinc-500">
                  {selectedAcademyData?.roles?.join(", ")}
                </p>
              </div>
            </div>
            <button
              onClick={() => setConfirmOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <RefreshCw className="h-3 w-3" /> Regenerate
            </button>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
            <code className="flex-1 truncate font-mono text-xs text-zinc-600 dark:text-zinc-400">
              {visible
                ? apiKey
                : apiKey.slice(0, 8) + "..." + apiKey.slice(-4)}
            </code>
            <button
              onClick={() => setVisible(!visible)}
              className="rounded-md p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              {visible ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={() => copyKey(apiKey)}
              className="rounded-md p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="glass flex flex-col items-center justify-center rounded-xl py-16 text-center">
          <Key className="mb-3 h-10 w-10 text-zinc-400" />
          <p className="font-medium text-zinc-500">No API key available</p>
          <p className="mt-1 text-sm text-zinc-400">
            Only academy owners can view API keys
          </p>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate API Key</AlertDialogTitle>
            <AlertDialogDescription>
              The current key will stop working immediately. Any integrations
              using this key will need to be updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={regenerateKey}
              className="bg-red-600 text-white hover:bg-red-500"
            >
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
