"use client";

import { useState } from "react";
import {
  GridLayout,
  ParticipantTile,
  ControlBar,
  Chat,
  RoomAudioRenderer,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Button } from "@/components/ui/button";
import { MessageSquare, Pencil } from "lucide-react";
import { WhiteboardPanel } from "./whiteboard-panel";

export function RoomView() {
  const [showChat, setShowChat] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 overflow-hidden">
        {/* Main video grid */}
        <div className="flex-1">
          <GridLayout tracks={tracks} className="h-full">
            <ParticipantTile />
          </GridLayout>
        </div>

        {/* Side panel */}
        {(showChat || showWhiteboard) && (
          <div className="flex w-80 flex-col border-l bg-card">
            {showChat && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="border-b px-4 py-2 text-sm font-medium">Chat</div>
                <Chat className="flex-1" />
              </div>
            )}
            {showWhiteboard && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="border-b px-4 py-2 text-sm font-medium">Whiteboard</div>
                <div className="flex-1">
                  <WhiteboardPanel />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-center gap-2 border-t bg-card px-4 py-3">
        <ControlBar
          variation="minimal"
          controls={{
            camera: true,
            microphone: true,
            screenShare: true,
            leave: true,
          }}
        />
        <div className="flex gap-1">
          <Button
            variant={showChat ? "default" : "outline"}
            size="sm"
            onClick={() => setShowChat(!showChat)}
          >
            <MessageSquare className="mr-1 h-4 w-4" />
            Chat
          </Button>
          <Button
            variant={showWhiteboard ? "default" : "outline"}
            size="sm"
            onClick={() => setShowWhiteboard(!showWhiteboard)}
          >
            <Pencil className="mr-1 h-4 w-4" />
            Board
          </Button>
        </div>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}
