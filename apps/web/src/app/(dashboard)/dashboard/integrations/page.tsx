"use client";

import { useState } from "react";
import { Plug, Key, Copy, RefreshCw, Eye, EyeOff, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useAcademy } from "@/components/academy-provider";
import { useApiClient } from "@/hooks/use-api-client";
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

const API_BASE_URL = typeof window !== "undefined" ? window.location.origin : "";

const CURL_EXAMPLES = [
  {
    title: "Create a class",
    command: `curl -X POST {{BASE_URL}}/api/v1/classes \\
  -H "Authorization: Bearer {{API_KEY}}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "English Conversation",
    "language": "en",
    "classType": "individual",
    "scheduledAt": "2026-03-10T14:00:00Z",
    "teacherEmail": "teacher@example.com",
    "students": [{ "email": "student@example.com", "name": "Jane" }]
  }'`,
  },
  {
    title: "List classes",
    command: `curl {{BASE_URL}}/api/v1/classes \\
  -H "Authorization: Bearer {{API_KEY}}"`,
  },
  {
    title: "List students",
    command: `curl {{BASE_URL}}/api/v1/students \\
  -H "Authorization: Bearer {{API_KEY}}"`,
  },
  {
    title: "Get usage stats",
    command: `curl {{BASE_URL}}/api/v1/usage \\
  -H "Authorization: Bearer {{API_KEY}}"`,
  },
];

export default function IntegrationsPage() {
  const { selectedAcademy, selectedAcademyData, loading, refetchAcademies } =
    useAcademy();
  const api = useApiClient();
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedExample, setCopiedExample] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const apiKey = selectedAcademyData?.apiKey;

  function maskedKey(key: string) {
    if (key.length <= 12) return "\u2022".repeat(key.length);
    return key.slice(0, 8) + "\u2022".repeat(16) + key.slice(-4);
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopied(true);
    toast.success("API key copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  function copyExample(index: number, command: string) {
    const resolved = command
      .replace(/\{\{BASE_URL\}\}/g, API_BASE_URL)
      .replace(/\{\{API_KEY\}\}/g, apiKey ?? "YOUR_API_KEY");
    navigator.clipboard.writeText(resolved);
    setCopiedExample(index);
    toast.success("Command copied to clipboard");
    setTimeout(() => setCopiedExample(null), 2000);
  }

  async function regenerateKey() {
    if (!selectedAcademy) return;
    setRegenerating(true);
    try {
      await api.academies.regenerateKey(selectedAcademy);
      await refetchAcademies();
      setVisible(false);
      toast.success("API key regenerated successfully");
    } catch {
      toast.error("Failed to regenerate API key");
    } finally {
      setRegenerating(false);
      setConfirmOpen(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-4 w-72 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="glass-subtle h-48 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!selectedAcademy) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="glass-subtle flex flex-col items-center justify-center rounded-xl border border-zinc-200/40 py-16 text-center dark:border-zinc-700/40">
          <Plug className="mb-3 h-10 w-10 text-zinc-400" />
          <p className="font-medium text-zinc-500">No academy selected</p>
          <p className="mt-1 text-sm text-zinc-400">
            Select an academy from the sidebar to manage integrations
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            API keys and developer tools for integrating with your academy
          </p>
        </div>
      </div>

      {/* API Key Card */}
      <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
        <div className="flex items-center gap-2 mb-4">
          <Key className="h-5 w-5 text-violet-500" />
          <h2 className="text-lg font-semibold">API Key</h2>
        </div>

        {apiKey ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
              <code className="flex-1 truncate font-mono text-sm text-zinc-600 dark:text-zinc-400">
                {visible ? apiKey : maskedKey(apiKey)}
              </code>
              <button
                onClick={() => setVisible(!visible)}
                className="rounded-md p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                title={visible ? "Hide key" : "Reveal key"}
              >
                {visible ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => copyKey(apiKey)}
                className="rounded-md p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                title="Copy to clipboard"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                <span className="font-medium text-zinc-600 dark:text-zinc-300">
                  Base URL:
                </span>{" "}
                <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">
                  {API_BASE_URL}/api/v1
                </code>
              </div>
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={regenerating}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                {regenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Regenerate
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Key className="mb-3 h-8 w-8 text-zinc-400" />
            <p className="font-medium text-zinc-500">No API key available</p>
            <p className="mt-1 text-sm text-zinc-400">
              Only academy owners can view API keys
            </p>
          </div>
        )}
      </div>

      {/* Quick Start Guide */}
      <div className="glass-subtle rounded-xl border border-zinc-200/40 p-6 dark:border-zinc-700/40">
        <div className="flex items-center gap-2 mb-4">
          <Plug className="h-5 w-5 text-violet-500" />
          <h2 className="text-lg font-semibold">Quick Start</h2>
        </div>

        <div className="space-y-4">
          {CURL_EXAMPLES.map((example, i) => (
            <div key={i}>
              <div className="mb-1.5 flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                  {example.title}
                </h3>
                <button
                  onClick={() => copyExample(i, example.command)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  {copiedExample === i ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" />
                      <span className="text-emerald-500">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-xs leading-relaxed text-zinc-300">
                <code>
                  {example.command
                    .replace(/\{\{BASE_URL\}\}/g, API_BASE_URL || "https://your-domain.com")
                    .replace(
                      /\{\{API_KEY\}\}/g,
                      apiKey
                        ? visible
                          ? apiKey
                          : apiKey.slice(0, 8) + "..."
                        : "YOUR_API_KEY"
                    )}
                </code>
              </pre>
            </div>
          ))}
        </div>
      </div>

      {/* Regenerate Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate API Key</AlertDialogTitle>
            <AlertDialogDescription>
              The current key will stop working immediately. Any integrations
              using this key will need to be updated with the new key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={regenerating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={regenerateKey}
              disabled={regenerating}
              className="bg-red-600 text-white hover:bg-red-500"
            >
              {regenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
