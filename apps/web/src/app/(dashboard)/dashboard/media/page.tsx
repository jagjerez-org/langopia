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
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageSkeleton, EmptyState, ListItem, IconAvatar } from "@/components/dashboard-list";
import { useAcademy } from "@/components/academy-provider";
import { useApiKeyClient } from "@/hooks/use-api-client";
import { useUpload } from "@/components/upload-progress-context";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  ready: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function MediaLibraryPage() {
  const { selectedAcademy, selectedAcademyData, loading: academyLoading } = useAcademy();
  const api = useApiKeyClient();
  const router = useRouter();
  const { addFiles, uploads } = useUpload();
  const hasActiveUploads = uploads.some((u) => u.status === "uploading" || u.status === "processing");

  const [items, setItems] = useState<MediaItemData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mimeFilter, setMimeFilter] = useState("all");

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<MediaItemData | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!selectedAcademyData?.apiKey) return;
    setLoading(true);
    try {
      const result = await api.media.list({
        search: search || undefined,
        mimeType: mimeFilter !== "all" ? mimeFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
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

  // Poll for processing items after page reload (widget not active)
  useEffect(() => {
    if (hasActiveUploads) return; // widget handles polling
    const hasProcessing = items.some((i) => i.status === "pending" || i.status === "processing");
    if (!hasProcessing) return;
    const timer = setInterval(fetchItems, 5000);
    return () => clearInterval(timer);
  }, [items, fetchItems, hasActiveUploads]);

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !selectedAcademyData?.apiKey) return;
    const files = Array.from(fileList);
    addFiles(files, api, fetchItems);
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
    return <PageSkeleton />;
  }

  if (!selectedAcademy) {
    return (
      <div className="mx-auto max-w-6xl">
        <EmptyState icon={FolderOpen} title="No academy selected" description="Select an academy from the sidebar to view media" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <PageHeader
        title="Media Library"
        subtitle="Upload and manage teaching materials — PDFs, slides, images, and documents."
        action={
          <label className="flex cursor-pointer items-center gap-2 bg-gradient-accent text-white shadow-md rounded-xl px-5 py-2.5 text-sm font-semibold transition hover:shadow-lg hover:brightness-110">
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
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-zinc-400" />
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchItems()}
            placeholder="Search..."
            className="h-8 w-48 pl-8 text-xs"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={mimeFilter} onValueChange={setMimeFilter}>
          <SelectTrigger className="h-8 w-auto min-w-[100px] text-xs">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="application/pdf">PDF</SelectItem>
            <SelectItem value="application/vnd.openxmlformats-officedocument.presentationml.presentation">PPTX</SelectItem>
            <SelectItem value="text/plain">Text</SelectItem>
            <SelectItem value="image/jpeg">Image</SelectItem>
          </SelectContent>
        </Select>
        {(statusFilter !== "all" || mimeFilter !== "all" || search.trim()) && (
          <button
            onClick={() => { setStatusFilter("all"); setMimeFilter("all"); setSearch(""); }}
            className="text-xs text-violet-600 hover:text-violet-500"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-zinc-400">
          {total} item{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Grid */}
      {loading && items.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass h-20 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={FolderOpen} title="No media files yet" description="Upload your first file to get started" />
      ) : (
        <div className="space-y-3">
          {items.filter((i) => hasActiveUploads ? (i.status === "ready" || i.status === "failed") : true).map((item) => {
            const FileIcon = getFileIcon(item.mimeType);

            return (
              <ListItem
                key={item.id}
                onClick={() => router.push(`/dashboard/media/${item.id}`)}
                className="group"
                avatar={<IconAvatar icon={FileIcon} />}
                title={<p className="truncate font-medium">{item.filename}</p>}
                badges={
                  <>
                    <Badge className={`shrink-0 text-[10px] ${STATUS_COLORS[item.status] ?? ""}`}>
                      {item.status}
                    </Badge>
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
                  </>
                }
                subtitle={
                  <>
                    <span>{formatFileSize(item.fileSize)}</span>
                    {item.totalPages > 0 && (
                      <>
                        <span>&middot;</span>
                        <span>{item.totalPages} page{item.totalPages !== 1 ? "s" : ""}</span>
                      </>
                    )}
                    {item.detectedTopic && (
                      <>
                        <span>&middot;</span>
                        <span className="truncate">{item.detectedTopic}</span>
                      </>
                    )}
                    {item.tags.length > 0 && (
                      <>
                        <span>&middot;</span>
                        <span>{item.tags.slice(0, 3).join(", ")}</span>
                      </>
                    )}
                  </>
                }
                actions={
                  <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
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
                }
              />
            );
          })}
        </div>
      )}

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
