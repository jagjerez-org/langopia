"use client";

import { useState, useCallback, useEffect } from "react";
import {
  FolderOpen,
  Search,
  FileText,
  Image,
  Presentation,
  File,
  Loader2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { useApiKeyClient } from "@/hooks/use-api-client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

interface MediaItemBrowse {
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
  tags: string[];
  similarExerciseCount: number;
}

interface MediaPageBrowse {
  extractedText: string;
}

interface MediaItemWithPages extends MediaItemBrowse {
  pages: MediaPageBrowse[];
}

export interface MediaSelection {
  mediaItemId: string;
  filename: string;
  extractedText: string;
  detectedTopic: string | null;
  detectedLanguage: string | null;
  detectedCefrLevel: string | null;
  similarExerciseCount: number;
}

interface MediaLibrarySidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (media: MediaSelection[]) => void;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.includes("presentation") || mimeType.includes("pptx")) return Presentation;
  if (mimeType.includes("pdf")) return FileText;
  return File;
}

export function MediaLibrarySidebar({
  open,
  onOpenChange,
  onSelect,
}: MediaLibrarySidebarProps) {
  const api = useApiKeyClient();
  const [items, setItems] = useState<MediaItemBrowse[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.media.list({ search: search || undefined, limit: 50 });
      setItems(result.data as unknown as MediaItemBrowse[]);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [api, search]);

  useEffect(() => {
    if (open) {
      fetchItems();
      setSelectedIds(new Set());
    }
  }, [open, fetchItems]);

  // Poll for any processing items in the list
  useEffect(() => {
    const hasProcessing = items.some((i) => i.status === "pending" || i.status === "processing");
    if (!hasProcessing) return;
    const timer = setInterval(fetchItems, 4000);
    return () => clearInterval(timer);
  }, [items, fetchItems]);

  async function handleSelect() {
    if (selectedIds.size === 0) return;
    setSelecting(true);
    try {
      const selections: MediaSelection[] = [];
      for (const id of selectedIds) {
        try {
          const item = await api.media.get(id) as unknown as MediaItemWithPages;

          const extractedText = (item.pages ?? [])
            .map((p) => p.extractedText)
            .join("\n\n");

          selections.push({
            mediaItemId: item.id,
            filename: item.filename,
            extractedText,
            detectedTopic: item.detectedTopic,
            detectedLanguage: item.detectedLanguage,
            detectedCefrLevel: item.detectedCefrLevel,
            similarExerciseCount: item.similarExerciseCount,
          });
        } catch {
          toast.error("Failed to load a media item");
        }
      }
      if (selections.length > 0) {
        onSelect(selections);
        onOpenChange(false);
      }
    } finally {
      setSelecting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-[420px] flex-col sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-violet-500" />
            Media Library
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-3 overflow-hidden">
          {/* Search */}
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchItems()}
              placeholder="Search media..."
              className="h-8 pl-8 text-xs"
            />
          </div>

          {/* Items list */}
          <ScrollArea className="flex-1">
            {loading && items.length === 0 ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center gap-1 text-zinc-400">
                <FolderOpen className="h-6 w-6" />
                <p className="text-xs">No media items yet</p>
              </div>
            ) : (
              <div className="space-y-1.5 pr-3">
                {items.map((item) => {
                  const Icon = getFileIcon(item.mimeType);
                  const isSelected = selectedIds.has(item.id);
                  const isProcessing = item.status === "pending" || item.status === "processing";
                  const isReady = item.status === "ready";
                  const progress = item.totalPages > 0
                    ? (item.processedPages / item.totalPages) * 100
                    : 10;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (!isReady) return;
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          return next;
                        });
                      }}
                      disabled={!isReady}
                      className={`flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition ${
                        isSelected
                          ? "bg-violet-50 ring-2 ring-violet-400 dark:bg-violet-900/20 dark:ring-violet-600"
                          : isReady
                            ? "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                            : "opacity-60"
                      }`}
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                        isSelected ? "bg-violet-100 dark:bg-violet-900/30" : "bg-zinc-100 dark:bg-zinc-800"
                      }`}>
                        {isSelected ? (
                          <Check className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                        ) : (
                          <Icon className="h-4 w-4 text-zinc-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{item.filename}</p>

                        {isProcessing && (
                          <div className="mt-1">
                            <Progress value={progress} className="h-1" />
                            <p className="mt-0.5 text-[10px] text-blue-500">
                              {item.totalPages > 0
                                ? `Processing ${item.processedPages}/${item.totalPages} pages...`
                                : "Analyzing..."}
                            </p>
                          </div>
                        )}

                        {item.status === "failed" && (
                          <p className="mt-0.5 text-[10px] text-red-500">Processing failed</p>
                        )}

                        {isReady && (
                          <>
                            {item.detectedTopic && (
                              <p className="truncate text-[10px] text-zinc-500">{item.detectedTopic}</p>
                            )}
                            <div className="mt-1 flex flex-wrap gap-0.5">
                              {item.detectedLanguage && (
                                <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                                  {item.detectedLanguage.toUpperCase()}
                                </Badge>
                              )}
                              {item.detectedCefrLevel && (
                                <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                                  {item.detectedCefrLevel}
                                </Badge>
                              )}
                              {item.tags.slice(0, 2).map((tag) => (
                                <Badge key={tag} variant="outline" className="h-4 px-1 text-[9px]">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-zinc-200 pt-3 dark:border-zinc-700">
          <Button
            onClick={handleSelect}
            disabled={selectedIds.size === 0 || selecting}
            className="w-full bg-gradient-to-r from-violet-600 to-purple-600"
          >
            {selecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            {selectedIds.size === 0
              ? "Select"
              : `Select ${selectedIds.size} file${selectedIds.size !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
