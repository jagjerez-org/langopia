"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Loader2,
  Save,
  RefreshCw,
  Dumbbell,
  ChevronDown,
  ChevronRight,
  X,
  Plus,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAcademy } from "@/components/academy-provider";
import { useApiKeyClient } from "@/hooks/use-api-client";
import { EXERCISE_LANGUAGES } from "@langopia/shared/types";
import { useAcademyLevels } from "@/hooks/use-academy-levels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MediaPageData {
  id: string;
  pageNumber: number;
  extractedText: string;
  imageUrl: string | null;
}

interface MediaItemDetail {
  id: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  storageUrl: string;
  previewUrl: string;
  status: string;
  totalPages: number;
  processedPages: number;
  detectedTopic: string | null;
  detectedLanguage: string | null;
  detectedCefrLevel: string | null;
  summary: string | null;
  tags: string[];
  similarExerciseCount: number;
  pages: MediaPageData[];
  createdAt: string;
  updatedAt: string;
}

export default function MediaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { selectedAcademyData, loading: academyLoading } = useAcademy();
  const api = useApiKeyClient();
  const { levelCodes } = useAcademyLevels();

  const [item, setItem] = useState<MediaItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [editTopic, setEditTopic] = useState("");
  const [editLanguage, setEditLanguage] = useState("");
  const [editCefrLevel, setEditCefrLevel] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

  // Page accordion
  const [expandedPage, setExpandedPage] = useState<number | null>(null);

  const fetchItem = useCallback(async () => {
    if (!selectedAcademyData?.apiKey || !id) return;
    setLoading(true);
    try {
      const result = await api.media.get(id) as unknown as { data: MediaItemDetail };
      const m = result.data;
      setItem(m);
      setEditTopic(m.detectedTopic ?? "");
      setEditLanguage(m.detectedLanguage ?? "en");
      setEditCefrLevel(m.detectedCefrLevel ?? "B1");
      setEditTags(m.tags ?? []);
    } catch {
      toast.error("Media item not found");
      router.push("/dashboard/media");
    } finally {
      setLoading(false);
    }
  }, [api, selectedAcademyData?.apiKey, id, router]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  // Poll while processing
  useEffect(() => {
    if (!item || (item.status !== "pending" && item.status !== "processing")) return;
    const timer = setInterval(fetchItem, 3000);
    return () => clearInterval(timer);
  }, [item, fetchItem]);

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    try {
      await api.media.update(id, {
        detectedTopic: editTopic || undefined,
        detectedLanguage: editLanguage || undefined,
        detectedCefrLevel: editCefrLevel || undefined,
        tags: editTags,
      });
      toast.success("Saved");
      fetchItem();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleRetry() {
    if (!id) return;
    try {
      await api.media.retry(id);
      toast.success("Retrying analysis...");
      fetchItem();
    } catch {
      toast.error("Retry failed");
    }
  }

  function addTag() {
    const tag = newTag.trim().toLowerCase();
    if (tag && !editTags.includes(tag)) {
      setEditTags([...editTags, tag]);
    }
    setNewTag("");
  }

  if (academyLoading || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-zinc-500">
        <FileText className="h-10 w-10" />
        <p>Media item not found</p>
      </div>
    );
  }

  const hasChanges =
    editTopic !== (item.detectedTopic ?? "") ||
    editLanguage !== (item.detectedLanguage ?? "en") ||
    editCefrLevel !== (item.detectedCefrLevel ?? "B1") ||
    JSON.stringify(editTags) !== JSON.stringify(item.tags ?? []);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard/media")}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">{item.filename}</h1>
          <p className="text-sm text-zinc-500">
            {(item.fileSize / (1024 * 1024)).toFixed(1)} MB &middot; {item.totalPages} page{item.totalPages !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {item.status === "failed" && (
            <Button variant="outline" size="sm" onClick={handleRetry}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/dashboard/exercises?topic=${encodeURIComponent(item.detectedTopic ?? "")}`)}
          >
            <Dumbbell className="mr-1 h-3.5 w-3.5" /> Generate Exercises
          </Button>
        </div>
      </div>

      {/* Similar exercises alert */}
      {item.similarExerciseCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {item.similarExerciseCount} exercise{item.similarExerciseCount !== 1 ? "s" : ""} already exist about this topic.
        </div>
      )}

      {/* File Preview */}
      <div className="overflow-hidden rounded-xl border border-zinc-200/60 bg-white shadow-sm dark:border-zinc-700/60 dark:bg-zinc-900">
        <div className="border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
          <h2 className="text-sm font-semibold">Preview</h2>
        </div>
        <div className="flex items-center justify-center bg-zinc-50 dark:bg-zinc-800/30">
          {item.mimeType.startsWith("image/") ? (
            <img
              src={item.previewUrl}
              alt={item.filename}
              className="max-h-96 object-contain"
            />
          ) : item.mimeType === "application/pdf" ? (
            <iframe
              src={item.previewUrl}
              title={item.filename}
              className="h-[500px] w-full"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 py-12 text-zinc-400">
              <FileText className="h-12 w-12" />
              <p className="text-sm">Preview not available for this file type</p>
              <a
                href={item.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-violet-600 underline hover:text-violet-700"
              >
                Download file
              </a>
            </div>
          )}
        </div>
      </div>

      {/* AI Summary */}
      {item.summary && (
        <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-500">
            AI Summary
          </div>
          {item.summary}
        </div>
      )}

      {/* Editable Metadata */}
      <div className="space-y-4 rounded-xl border border-zinc-200/60 bg-white p-5 shadow-sm dark:border-zinc-700/60 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Metadata</h2>
          {hasChanges && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
              Save Changes
            </Button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500">Topic</label>
            <Input value={editTopic} onChange={(e) => setEditTopic(e.target.value)} placeholder="Detected topic..." />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500">Language</label>
            <select
              value={editLanguage}
              onChange={(e) => setEditLanguage(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              {EXERCISE_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500">CEFR Level</label>
            <select
              value={editCefrLevel}
              onChange={(e) => setEditCefrLevel(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              {levelCodes.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-500">Tags</label>
          <div className="flex flex-wrap items-center gap-1.5">
            {editTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button
                  onClick={() => setEditTags(editTags.filter((t) => t !== tag))}
                  className="hover:text-red-500"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
            <div className="flex items-center gap-1">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                placeholder="Add tag..."
                className="h-7 w-24 text-xs"
              />
              <button
                onClick={addTag}
                disabled={!newTag.trim()}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-30 dark:hover:bg-zinc-800"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Pages */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">
          Extracted Content ({item.pages?.length ?? 0} page{(item.pages?.length ?? 0) !== 1 ? "s" : ""})
        </h2>
        {(item.pages ?? []).map((page) => {
          const isExpanded = expandedPage === page.pageNumber;
          const wordCount = page.extractedText.trim().split(/\s+/).filter(Boolean).length;
          return (
            <div
              key={page.id}
              className="rounded-lg border border-zinc-200/60 dark:border-zinc-700/60"
            >
              <button
                onClick={() => setExpandedPage(isExpanded ? null : page.pageNumber)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <span>Page {page.pageNumber}</span>
                <span className="flex items-center gap-2 text-xs text-zinc-400">
                  {wordCount} word{wordCount !== 1 ? "s" : ""} &middot; {page.extractedText.length} chars
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </span>
              </button>
              {isExpanded && (
                <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
                  {page.imageUrl && (
                    <img src={page.imageUrl} alt={`Page ${page.pageNumber}`} className="mb-3 max-h-60 rounded-lg" />
                  )}
                  <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
                    {page.extractedText || "(No text extracted)"}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
