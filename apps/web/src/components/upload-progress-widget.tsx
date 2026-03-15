"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  CheckCircle,
  X,
  XCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Image,
  Presentation,
  File,
  Loader2,
} from "lucide-react";
import { useUpload } from "./upload-progress-context";
import type { UploadItem } from "./upload-progress-context";
import { useWizard } from "./exercise-wizard-context";

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

function FileRow({ item, onCancel }: { item: UploadItem; onCancel: () => void }) {
  const Icon = getFileIcon(item.mimeType);
  const percent = item.total > 0 ? Math.round((item.loaded / item.total) * 100) : 0;

  const statusLabel =
    item.status === "uploading"
      ? `${percent}%`
      : item.status === "processing"
        ? item.totalPages && item.totalPages > 0
          ? `${item.processedPages ?? 0}/${item.totalPages} pages`
          : "Analyzing..."
        : item.status === "complete"
          ? formatFileSize(item.fileSize)
          : item.status === "error"
            ? "Failed"
            : "";

  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-zinc-400" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm text-zinc-700 dark:text-zinc-300">
            {item.filename}
          </p>
          <span className="shrink-0 text-[10px] text-zinc-400">
            {statusLabel}
          </span>
        </div>
        {item.status === "uploading" && (
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-600 transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
        {item.status === "processing" && (
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="h-full rounded-full bg-blue-500 animate-pulse" style={{ width: "100%" }} />
          </div>
        )}
        {item.status === "complete" && (
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="h-full w-full rounded-full bg-emerald-500" />
          </div>
        )}
        {item.status === "error" && (
          <p className="mt-0.5 truncate text-[10px] text-red-500">
            {item.error}
          </p>
        )}
      </div>
      <div className="shrink-0">
        {item.status === "uploading" ? (
          <button
            onClick={onCancel}
            className="rounded-md p-1 text-zinc-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
            title="Cancel upload"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : item.status === "processing" ? (
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        ) : item.status === "complete" ? (
          <CheckCircle className="h-4 w-4 text-emerald-500" />
        ) : item.status === "error" ? (
          <XCircle className="h-4 w-4 text-red-500" />
        ) : null}
      </div>
    </div>
  );
}

export function UploadProgressWidget() {
  const { uploads, isVisible, cancelUpload, clearCompleted, dismiss } = useUpload();
  const { isMinimized: wizardMinimized } = useWizard();
  const [isMinimized, setIsMinimized] = useState(false);

  // Dragging
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const widgetRef = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    const rect = widgetRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const x = Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - 380));
    const y = Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 60));
    setDragPos({ x, y });
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  if (!isVisible || uploads.length === 0) return null;

  const active = uploads.filter((u) => u.status === "uploading" || u.status === "processing");
  const completed = uploads.filter((u) => u.status === "complete");
  const failed = uploads.filter((u) => u.status === "error");
  const uploading = uploads.filter((u) => u.status === "uploading");
  const processing = uploads.filter((u) => u.status === "processing");
  const allDone = active.length === 0;

  // Aggregate progress (upload phase only)
  const totalBytes = uploads.reduce((s, u) => s + u.total, 0);
  const loadedBytes = uploads.reduce((s, u) => s + u.loaded, 0);
  const aggregatePercent = totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : 0;

  const headerText = allDone
    ? `${completed.length} file${completed.length !== 1 ? "s" : ""} ready${failed.length > 0 ? `, ${failed.length} failed` : ""}`
    : uploading.length > 0
      ? `Uploading ${uploading.length} file${uploading.length !== 1 ? "s" : ""}${processing.length > 0 ? `, ${processing.length} processing` : ""}`
      : `Processing ${processing.length} file${processing.length !== 1 ? "s" : ""}`;

  const positionStyle: React.CSSProperties = dragPos
    ? { left: dragPos.x, top: dragPos.y, right: "auto", bottom: "auto" }
    : { right: 16, bottom: wizardMinimized ? 80 : 16 };

  if (isMinimized) {
    return (
      <div
        ref={widgetRef}
        style={positionStyle}
        className="fixed z-50 w-[320px] animate-in slide-in-from-bottom-4 fade-in duration-300 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div
          className="flex cursor-grab items-center gap-3 active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {allDone ? (
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-500" />
          )}
          <button
            onClick={() => setIsMinimized(false)}
            className="flex-1 truncate text-left text-sm font-medium text-zinc-700 hover:text-violet-600 dark:text-zinc-300 dark:hover:text-violet-400"
          >
            {headerText}
          </button>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => setIsMinimized(false)}
              className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={dismiss}
              className="rounded-md p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {!allDone && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            {uploading.length > 0 ? (
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-600 transition-all duration-300"
                style={{ width: `${aggregatePercent}%` }}
              />
            ) : (
              <div className="h-full rounded-full bg-blue-500 animate-pulse" style={{ width: "100%" }} />
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={widgetRef}
      style={positionStyle}
      className="fixed z-50 w-[380px] animate-in slide-in-from-bottom-4 fade-in duration-300 rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
    >
      {/* Header */}
      <div
        className="flex cursor-grab items-center gap-3 border-b border-zinc-100 px-4 py-3 active:cursor-grabbing dark:border-zinc-800"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {allDone ? (
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
        ) : processing.length > 0 && uploading.length === 0 ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />
        ) : (
          <Upload className="h-4 w-4 shrink-0 text-violet-500" />
        )}
        <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {headerText}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {allDone && (
            <button
              onClick={clearCompleted}
              className="rounded-md px-2 py-1 text-[10px] font-medium text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setIsMinimized(true)}
            className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
            title="Minimize"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={dismiss}
            className="rounded-md p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* File list */}
      <div className="max-h-[280px] overflow-y-auto px-4 py-1 divide-y divide-zinc-100 dark:divide-zinc-800">
        {uploads.map((item) => (
          <FileRow
            key={item.id}
            item={item}
            onCancel={() => cancelUpload(item.id)}
          />
        ))}
      </div>

      {/* Aggregate progress footer */}
      {!allDone && (
        <div className="border-t border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
          {uploading.length > 0 ? (
            <>
              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                <span>
                  {formatFileSize(loadedBytes)} / {formatFileSize(totalBytes)}
                </span>
                <span>{aggregatePercent}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-600 transition-all duration-300"
                  style={{ width: `${aggregatePercent}%` }}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-[10px] text-blue-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Analyzing files...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
