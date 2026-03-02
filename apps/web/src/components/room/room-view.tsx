"use client";

import { useState, useCallback } from "react";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useDataChannel,
} from "@livekit/components-react";
import "@livekit/components-styles";
import {
  MessageSquare,
  StickyNote,
  Presentation,
  PenTool,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { RoomChat } from "./room-chat";
import { RoomNotes } from "./room-notes";

interface RoomSession {
  roomId: string;
  title: string;
  language: string;
  role: "teacher" | "student";
  participantId: string;
  livekitToken: string;
  livekitUrl: string;
  slides: string[];
  status: string;
}

interface RoomViewProps {
  session: RoomSession;
}

type SidePanel = "chat" | "notes" | "slides" | null;

export function RoomView({ session }: RoomViewProps) {
  const [sidePanel, setSidePanel] = useState<SidePanel>("chat");
  const [disconnected, setDisconnected] = useState(false);

  const togglePanel = (panel: SidePanel) => {
    setSidePanel((prev) => (prev === panel ? null : panel));
  };

  if (disconnected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Class Ended</h1>
          <p className="mt-2 text-zinc-400">
            Thank you for attending! You can close this tab.
          </p>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={session.livekitUrl}
      token={session.livekitToken}
      connect={true}
      onDisconnected={() => setDisconnected(true)}
      data-lk-theme="default"
      className="flex h-screen flex-col bg-zinc-950"
    >
      <RoomAudioRenderer />

      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-bold text-white">
            L
          </div>
          <h1 className="text-sm font-semibold text-white">{session.title}</h1>
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
            {session.language.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {session.slides.length > 0 && (
            <ToolbarButton
              icon={Presentation}
              label="Slides"
              active={sidePanel === "slides"}
              onClick={() => togglePanel("slides")}
            />
          )}
          <ToolbarButton
            icon={MessageSquare}
            label="Chat"
            active={sidePanel === "chat"}
            onClick={() => togglePanel("chat")}
          />
          <ToolbarButton
            icon={StickyNote}
            label="Notes"
            active={sidePanel === "notes"}
            onClick={() => togglePanel("notes")}
          />
        </div>
      </header>

      {/* Main content */}
      <div className="flex min-h-0 flex-1">
        {/* Video area */}
        <div className="min-w-0 flex-1">
          <VideoConference />
        </div>

        {/* Side panel */}
        {sidePanel && (
          <div className="flex w-80 shrink-0 flex-col border-l border-zinc-800 bg-zinc-900/50">
            <div className="flex h-10 items-center justify-between border-b border-zinc-800 px-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {sidePanel}
              </span>
              <button
                onClick={() => setSidePanel(null)}
                className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {sidePanel === "chat" && (
                <RoomChat roomId={session.roomId} role={session.role} />
              )}
              {sidePanel === "notes" && (
                <RoomNotes
                  roomId={session.roomId}
                  isTeacher={session.role === "teacher"}
                />
              )}
              {sidePanel === "slides" && (
                <SlideViewer
                  slides={session.slides}
                  isTeacher={session.role === "teacher"}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </LiveKitRoom>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-violet-600/20 text-violet-400"
          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
      }`}
      title={label}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function SlideViewer({
  slides,
  isTeacher,
}: {
  slides: string[];
  isTeacher: boolean;
}) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const prev = () => setCurrentSlide((i) => Math.max(0, i - 1));
  const next = () => setCurrentSlide((i) => Math.min(slides.length - 1, i + 1));

  if (slides.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        No slides for this class
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <iframe
          src={slides[currentSlide]}
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups"
          title={`Slide ${currentSlide + 1}`}
        />
      </div>
      <div className="flex items-center justify-between border-t border-zinc-800 px-3 py-2">
        <button
          onClick={prev}
          disabled={currentSlide === 0}
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs text-zinc-500">
          {currentSlide + 1} / {slides.length}
        </span>
        <button
          onClick={next}
          disabled={currentSlide === slides.length - 1}
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
