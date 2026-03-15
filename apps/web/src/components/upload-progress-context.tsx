"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import type { LangopiaClient } from "@langopia/api-client";

export type UploadStatus = "uploading" | "processing" | "complete" | "error" | "cancelled";

export interface UploadItem {
  id: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  loaded: number;
  total: number;
  status: UploadStatus;
  error?: string;
  abortController: AbortController;
  mediaId?: string;
  processedPages?: number;
  totalPages?: number;
}

interface UploadContextValue {
  uploads: UploadItem[];
  isVisible: boolean;
  addFiles: (
    files: File[],
    api: LangopiaClient,
    onAllComplete?: () => void,
  ) => void;
  cancelUpload: (id: string) => void;
  clearCompleted: () => void;
  dismiss: () => void;
}

const UploadContext = createContext<UploadContextValue | null>(null);

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onAllCompleteRef = useRef<(() => void) | undefined>(undefined);
  const apiRef = useRef<LangopiaClient | null>(null);
  const pollingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep a ref to current uploads so polling can read without stale closures
  const uploadsRef = useRef<UploadItem[]>([]);
  uploadsRef.current = uploads;

  const handleAllDone = useCallback(() => {
    if (pollingTimer.current) {
      clearInterval(pollingTimer.current);
      pollingTimer.current = null;
    }
    onAllCompleteRef.current?.();
    onAllCompleteRef.current = undefined;
    if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
    autoDismissTimer.current = setTimeout(() => {
      setUploads([]);
      setIsVisible(false);
    }, 5000);
  }, []);

  // Polling function — reads from ref, writes via setUploads
  const pollOnce = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;

    const current = uploadsRef.current;
    const processingItems = current.filter((u) => u.status === "processing" && u.mediaId);
    if (processingItems.length === 0) return;

    const results = await Promise.allSettled(
      processingItems.map((item) => api.media.get(item.mediaId!))
    );

    setUploads((prev) => {
      let changed = false;
      const updated = prev.map((u) => {
        if (u.status !== "processing" || !u.mediaId) return u;
        const idx = processingItems.findIndex((p) => p.id === u.id);
        if (idx === -1) return u;
        const result = results[idx];
        if (result.status !== "fulfilled") return u;
        // API returns { data: item } — unwrap if needed
        const raw = result.value as unknown as Record<string, unknown>;
        const media = (raw.data && typeof raw.data === "object" ? raw.data : raw) as {
          status?: string;
          processedPages?: number;
          totalPages?: number;
        };
        if (media.status === "ready" || media.status === "failed") {
          changed = true;
          return {
            ...u,
            status: (media.status === "ready" ? "complete" : "error") as UploadStatus,
            error: media.status === "failed" ? "Processing failed" : undefined,
            processedPages: media.processedPages,
            totalPages: media.totalPages,
          };
        }
        return {
          ...u,
          processedPages: media.processedPages,
          totalPages: media.totalPages,
        };
      });

      // Check if all done
      if (changed) {
        const allDone = updated.every((u) => u.status === "complete" || u.status === "error" || u.status === "cancelled");
        if (allDone) {
          // Schedule handleAllDone outside of setState
          setTimeout(() => handleAllDone(), 0);
        }
      }

      return updated;
    });
  }, [handleAllDone]);

  // Start/stop polling interval
  useEffect(() => {
    const hasProcessing = uploads.some((u) => u.status === "processing");
    if (hasProcessing && !pollingTimer.current) {
      // Do an immediate poll, then every 4s
      pollOnce();
      pollingTimer.current = setInterval(pollOnce, 4000);
    } else if (!hasProcessing && pollingTimer.current) {
      clearInterval(pollingTimer.current);
      pollingTimer.current = null;
    }
  }, [uploads, pollOnce]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingTimer.current) clearInterval(pollingTimer.current);
      if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
    };
  }, []);

  const addFiles = useCallback(
    (files: File[], api: LangopiaClient, onAllComplete?: () => void) => {
      if (autoDismissTimer.current) {
        clearTimeout(autoDismissTimer.current);
        autoDismissTimer.current = null;
      }

      onAllCompleteRef.current = onAllComplete;
      apiRef.current = api;

      const newItems: UploadItem[] = files.map((f) => ({
        id: crypto.randomUUID(),
        filename: f.name,
        fileSize: f.size,
        mimeType: f.type || "application/octet-stream",
        loaded: 0,
        total: f.size,
        status: "uploading" as const,
        abortController: new AbortController(),
      }));

      setUploads((prev) => [...newItems, ...prev]);
      setIsVisible(true);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const item = newItems[i];

        api.media
          .uploadWithProgress(file, {
            onProgress: (loaded, total) => {
              setUploads((prev) =>
                prev.map((u) =>
                  u.id === item.id ? { ...u, loaded, total } : u,
                ),
              );
            },
            signal: item.abortController.signal,
          })
          .then((response) => {
            // API returns { data: item, duplicate: bool } — unwrap
            const raw = response as unknown as Record<string, unknown>;
            const media = (raw.data && typeof raw.data === "object" ? raw.data : raw) as {
              id: string;
              status: string;
            };
            setUploads((prev) => {
              const updated = prev.map((u) =>
                u.id === item.id
                  ? {
                      ...u,
                      status: (media.status === "ready" ? "complete" : "processing") as UploadStatus,
                      loaded: u.total,
                      mediaId: media.id,
                    }
                  : u,
              );
              // If already ready, check if all done
              const allDone = updated.every((u) => u.status === "complete" || u.status === "error" || u.status === "cancelled");
              if (allDone) setTimeout(() => handleAllDone(), 0);
              return updated;
            });
          })
          .catch((err: unknown) => {
            const isCancelled =
              err instanceof DOMException && err.name === "AbortError";
            setUploads((prev) => {
              const updated = prev.map((u) =>
                u.id === item.id
                  ? {
                      ...u,
                      status: (isCancelled ? "cancelled" : "error") as UploadStatus,
                      error: isCancelled
                        ? undefined
                        : err instanceof Error
                          ? err.message
                          : "Upload failed",
                    }
                  : u,
              );
              const allDone = updated.every((u) => u.status === "complete" || u.status === "error" || u.status === "cancelled");
              if (allDone) setTimeout(() => handleAllDone(), 0);
              return updated;
            });
          });
      }
    },
    [handleAllDone],
  );

  const cancelUpload = useCallback((id: string) => {
    setUploads((prev) => {
      const item = prev.find((u) => u.id === id);
      if (item && item.status === "uploading") {
        item.abortController.abort();
      }
      return prev.filter((u) => u.id !== id);
    });
  }, []);

  const clearCompleted = useCallback(() => {
    setUploads((prev) => prev.filter((u) => u.status === "uploading" || u.status === "processing"));
  }, []);

  const dismiss = useCallback(() => {
    if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
    if (pollingTimer.current) {
      clearInterval(pollingTimer.current);
      pollingTimer.current = null;
    }
    onAllCompleteRef.current?.();
    onAllCompleteRef.current = undefined;
    setUploads([]);
    setIsVisible(false);
  }, []);

  return (
    <UploadContext.Provider
      value={{ uploads, isVisible, addFiles, cancelUpload, clearCompleted, dismiss }}
    >
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUpload must be used within UploadProvider");
  return ctx;
}
