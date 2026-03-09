"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FolderOpen,
  Upload,
  Search,
  FileText,
  Image,
  Presentation,
  File,
  Loader2,
  Trash2,
  RefreshCw,
  Eye,
  Filter,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAcademy } from "@/components/academy-provider";
import { useApiKeyClient } from "@/hooks/use-api-client";
import { useAcademyLevels } from "@/hooks/use-academy-levels";
import { useRouter } from "next/navigation";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

interface MediaItemData {
  id: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  status: string;
  totalPages: number;
  processedPages: number;
  detectedTopic: string | null;
  detectedLanguage: string | null;
  detectedCefrLevel: string | null;
  summary: string | null;
  tags: string[];
  similarExerciseCount: number;
  createdAt: string;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.includes("presentation") || mimeType.includes("pptx")) return Presentation;
  if (mimeType.includes("pdf")) return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  ready: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function MediaLibraryPage() {
  const { selectedAcademy, selectedAcademyData, loading: academyLoading } = useAcademy();
  const api = useApiKeyClient();
  const router = useRouter();
  const { levelCodes } = useAcademyLevels();

  const [items, setItems] = useState<MediaItemData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [mimeFilter, setMimeFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCefrLevel, setUploadCefrLevel] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<MediaItemData | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!selectedAcademyData?.apiKey) return;
    setLoading(true);
    try {
      const result = await api.media.list({
        search: search || undefined,
        mimeType: mimeFilter || undefined,
        status: statusFilter || undefined,
        limit: 50,
        offset: 0,
      });
      setItems(result.data as unknown as MediaItemData[]);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, [api, selectedAcademyData?.apiKey, search, statusFilter, mimeFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Poll for processing items
  useEffect(() => {
    const hasProcessing = items.some((i) => i.status === "pending" || i.status === "processing");
    if (!hasProcessing) return;
    const timer = setInterval(fetchItems, 5000);
    return () => clearInterval(timer);
  }, [items, fetchItems]);

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setPendingFiles(Array.from(fileList));
    setUploadOpen(true);
  }

  function handleConfirmUpload() {
    if (pendingFiles.length === 0 || !selectedAcademyData?.apiKey || !uploadCefrLevel) return;

    // Capture values and close dialog immediately
    const filesToUpload = [...pendingFiles];
    const cefrLevel = uploadCefrLevel;

    setUploadOpen(false);
    setPendingFiles([]);
    setUploadCefrLevel("");
    setUploading(true);

    const totalFiles = filesToUpload.length;
    toast.info(`Uploading ${totalFiles} file${totalFiles !== 1 ? "s" : ""} in background...`);

    // Run uploads in background
    (async () => {
      let uploaded = 0;
      let failed = 0;
      for (const file of filesToUpload) {
        try {
          const data = await api.media.upload(file, cefrLevel) as unknown as { duplicate?: boolean };
          if (data.duplicate) {
            toast.info(`"${file.name}" already exists`);
          } else {
            uploaded++;
          }
        } catch (err: unknown) {
          failed++;
          const message = err instanceof Error ? err.message : `Failed to upload "${file.name}"`;
          toast.error(message);
        }
      }
      if (uploaded > 0) {
        toast.success(`${uploaded} file${uploaded !== 1 ? "s" : ""} uploaded successfully`);
      }
      setUploading(false);
      fetchItems();
    })();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.media.delete(deleteTarget.id);
      toast.success("Deleted");
      setDeleteTarget(null);
      fetchItems();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  async function handleRetry(item: MediaItemData) {
    try {
      await api.media.retry(item.id);
      toast.success("Retrying analysis...");
      fetchItems();
    } catch {
      toast.error("Retry failed");
    }
  }

  if (academyLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!selectedAcademy) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-zinc-500">
        <FolderOpen className="h-10 w-10" />
        <p>Select an academy to view the media library</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Media Library</h1>
          <p className="text-sm text-zinc-500">
            Upload and manage teaching materials — PDFs, slides, images, and documents.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:shadow-lg">
          <Upload className="h-4 w-4" />
          Upload
          <input
            type="file"
            multiple
            accept=".pdf,.pptx,.txt,.md,.csv,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => {
              handleFilesSelected(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchItems()}
            placeholder="Search by filename or topic..."
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={showFilters ? "bg-violet-50 dark:bg-violet-900/20" : ""}
        >
          <Filter className="mr-1 h-3.5 w-3.5" /> Filters
        </Button>
        <Button variant="outline" size="sm" onClick={fetchItems} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {showFilters && (
        <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-800/30">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="">All statuses</option>
            <option value="ready">Ready</option>
            <option value="processing">Processing</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <select
            value={mimeFilter}
            onChange={(e) => setMimeFilter(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="">All types</option>
            <option value="application/pdf">PDF</option>
            <option value="application/vnd.openxmlformats-officedocument.presentationml.presentation">PPTX</option>
            <option value="text/plain">Text</option>
            <option value="image/jpeg">Image</option>
          </select>
          {(statusFilter || mimeFilter) && (
            <button
              onClick={() => { setStatusFilter(""); setMimeFilter(""); }}
              className="text-xs text-zinc-500 hover:text-red-500"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="text-xs text-zinc-500">
        {total} item{total !== 1 ? "s" : ""}
      </div>

      {/* Grid */}
      {loading && items.length === 0 ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 text-zinc-400 dark:border-zinc-700">
          <FolderOpen className="h-8 w-8" />
          <p className="text-sm">No media files yet. Upload your first file to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const Icon = getFileIcon(item.mimeType);
            const isProcessing = item.status === "pending" || item.status === "processing";
            const progress = item.totalPages > 0 ? (item.processedPages / item.totalPages) * 100 : 0;

            return (
              <div
                key={item.id}
                className="group relative rounded-xl border border-zinc-200/60 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-zinc-700/60 dark:bg-zinc-900"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    <Icon className="h-5 w-5 text-zinc-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.filename}</p>
                    <p className="text-xs text-zinc-500">{formatFileSize(item.fileSize)}</p>
                  </div>
                  <Badge className={`shrink-0 text-[10px] ${STATUS_STYLES[item.status] ?? ""}`}>
                    {item.status}
                  </Badge>
                </div>

                {isProcessing && item.totalPages > 0 && (
                  <div className="mt-3">
                    <Progress value={progress} className="h-1.5" />
                    <p className="mt-1 text-[10px] text-zinc-400">
                      {item.processedPages}/{item.totalPages} pages
                    </p>
                  </div>
                )}

                {item.status === "ready" && (
                  <div className="mt-3 space-y-1.5">
                    {item.detectedTopic && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        {item.detectedTopic}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {item.detectedLanguage && (
                        <Badge variant="secondary" className="text-[10px]">
                          {item.detectedLanguage.toUpperCase()}
                        </Badge>
                      )}
                      {item.detectedCefrLevel && (
                        <Badge variant="secondary" className="text-[10px]">
                          {item.detectedCefrLevel}
                        </Badge>
                      )}
                      {item.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                      {item.totalPages > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          {item.totalPages} page{item.totalPages !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-3 flex items-center gap-1.5 opacity-0 transition group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => router.push(`/dashboard/media/${item.id}`)}
                  >
                    <Eye className="mr-1 h-3 w-3" /> View
                  </Button>
                  {item.status === "failed" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleRetry(item)}
                    >
                      <RefreshCw className="mr-1 h-3 w-3" /> Retry
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                    onClick={() => setDeleteTarget(item)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(open) => {
        if (!open && !uploading) {
          setUploadOpen(false);
          setPendingFiles([]);
          setUploadCefrLevel("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
            <DialogDescription>
              Select the CEFR level for {pendingFiles.length === 1 ? "this file" : `these ${pendingFiles.length} files`}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Files list */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500">Files</label>
              <div className="max-h-32 space-y-1 overflow-auto">
                {pendingFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    <span className="truncate">{f.name}</span>
                    <span className="shrink-0 text-xs text-zinc-400">
                      {f.size < 1024 * 1024
                        ? `${(f.size / 1024).toFixed(0)} KB`
                        : `${(f.size / (1024 * 1024)).toFixed(1)} MB`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* CEFR Level selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500">CEFR Level *</label>
              <div className="grid grid-cols-6 gap-2">
                {levelCodes.map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setUploadCefrLevel(lvl)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      uploadCefrLevel === lvl
                        ? "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                        : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setUploadOpen(false); setPendingFiles([]); setUploadCefrLevel(""); }}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmUpload}
              disabled={!uploadCefrLevel || uploading}
              className="bg-gradient-to-r from-violet-600 to-purple-600 text-white"
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Media Item</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteTarget?.filename}&quot; and all associated pages.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
