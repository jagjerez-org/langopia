"use client";

import { useState, useMemo } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  TrackRefContext,
  useTracks,
  VideoTrack,
  ParticipantName,
  useConnectionState,
  TrackToggle,
  DisconnectButton,
} from "@livekit/components-react";
import { Track, ConnectionState as LKConnectionState } from "livekit-client";
import {
  MessageSquare,
  StickyNote,
  Presentation,
  X,
  ChevronLeft,
  ChevronRight,
  PhoneOff,
  Loader2,
} from "lucide-react";
import { createPublicClient } from "@/hooks/use-api-client";
import { useLiveTranscription } from "@/hooks/use-live-transcription";
import { useEndOfClassSuggestions } from "@/hooks/use-end-of-class-suggestions";
import { useSpeakingTracker } from "@/hooks/use-speaking-tracker";
import { RoomChat } from "./room-chat";
import { RoomNotes } from "./room-notes";
import { RoomSuggestions } from "./room-suggestions";
import { SpeakingIndicator } from "./speaking-indicator";

export interface RoomSession {
  roomId: string;
  title: string;
  language: string;
  role: "teacher" | "student";
  participantId: string;
  participantName: string;
  livekitToken: string;
  livekitUrl: string;
  slides: string[];
  status: string;
  scheduledAt: string | null;
  durationMinutes: number | null;
}

interface RoomViewProps {
  session: RoomSession;
}

type SidePanel = "chat" | "notes" | "slides" | null;

export function RoomView({ session }: RoomViewProps) {
  const [disconnected, setDisconnected] = useState(false);

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
      className="flex h-screen flex-col bg-zinc-950"
    >
      <RoomAudioRenderer />
      <RoomInner session={session} />
    </LiveKitRoom>
  );
}

/** Inner component that has access to LiveKit context for hooks */
function RoomInner({ session }: { session: RoomSession }) {
  const [sidePanel, setSidePanel] = useState<SidePanel>("chat");
  const api = useMemo(() => createPublicClient(), []);
  const speakingStats = useSpeakingTracker();

  // Live transcription (student only)
  useLiveTranscription({
    roomId: session.roomId,
    role: session.role,
    participantId: session.participantId,
    api,
  });

  // Content suggestions (teacher only, 5 min before end)
  const { suggestions, loading: suggestionsLoading } =
    useEndOfClassSuggestions({
      roomId: session.roomId,
      role: session.role,
      scheduledAt: session.scheduledAt,
      durationMinutes: session.durationMinutes,
      api,
    });

  const togglePanel = (panel: SidePanel) => {
    setSidePanel((prev) => (prev === panel ? null : panel));
  };

  return (
    <>
      {/* Minimal header: title + language */}
      <header className="flex h-10 shrink-0 items-center border-b border-zinc-800 bg-zinc-900/80 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-purple-600 text-[10px] font-bold text-white">
            L
          </div>
          <h1 className="text-sm font-semibold text-white">
            {session.title}
          </h1>
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
            {session.language.toUpperCase()}
          </span>
        </div>
      </header>

      {/* Main content */}
      <div className="relative flex min-h-0 flex-1">
        {/* Video grid */}
        <div className="min-w-0 flex-1">
          <RoomContent />
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
                <RoomChat
                  roomId={session.roomId}
                  role={session.role}
                  senderName={session.participantName}
                />
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

        {/* Content suggestions overlay (teacher only) */}
        {session.role === "teacher" && (
          <RoomSuggestions
            suggestions={suggestions}
            loading={suggestionsLoading}
          />
        )}
      </div>

      {/* Unified bottom bar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-t border-zinc-800 bg-zinc-900/90 px-4">
        {/* Left: Media controls */}
        <div className="flex items-center gap-1">
          <TrackToggle
            source={Track.Source.Microphone}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white data-[lk-muted=true]:text-red-400"
          />
          <TrackToggle
            source={Track.Source.Camera}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white data-[lk-muted=true]:text-red-400"
          />
          <TrackToggle
            source={Track.Source.ScreenShare}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white data-[lk-enabled=true]:text-violet-400"
          />
        </div>

        {/* Center: Panel toggles */}
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

        {/* Right: Speaking indicator + Disconnect */}
        <div className="flex items-center gap-3">
          <SpeakingIndicator stats={speakingStats} />
          <DisconnectButton className="flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-medium text-white transition-colors hover:bg-red-500">
            <PhoneOff className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </DisconnectButton>
        </div>
      </div>
    </>
  );
}

/** Custom video grid using useTracks */
function RoomContent() {
  const connectionState = useConnectionState();
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  if (connectionState === LKConnectionState.Connecting) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Waiting for participants...
      </div>
    );
  }

  const gridCols =
    tracks.length === 1
      ? "grid-cols-1"
      : tracks.length <= 4
        ? "grid-cols-2"
        : "grid-cols-3";

  return (
    <div className={`grid h-full gap-2 p-2 ${gridCols}`}>
      {tracks.map((trackRef) => (
        <TrackRefContext.Provider
          key={
            trackRef.participant.sid +
            (trackRef.publication?.trackSid ?? "placeholder")
          }
          value={trackRef}
        >
          <div className="relative overflow-hidden rounded-xl bg-zinc-800">
            {trackRef.publication?.track ? (
              <VideoTrack
                trackRef={trackRef}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-700 text-xl font-bold text-zinc-300">
                  {trackRef.participant.name?.charAt(0)?.toUpperCase() ?? "?"}
                </div>
              </div>
            )}
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-xs text-white backdrop-blur-sm">
              <ParticipantName />
            </div>
          </div>
        </TrackRefContext.Provider>
      ))}
    </div>
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
  const next = () =>
    setCurrentSlide((i) => Math.min(slides.length - 1, i + 1));

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
