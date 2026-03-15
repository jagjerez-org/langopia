import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  Dimensions,
  SafeAreaView,
  Alert,
} from "react-native";
import {
  LiveKitRoom,
  VideoTrack,
  AudioSession,
} from "@livekit/react-native";
import {
  useTracks,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import type { TrackReference } from "@livekit/components-react";
import { Ionicons } from "@expo/vector-icons";
import { RoomChatNative } from "./room-chat-native";
import { createPublicRoomClient } from "@/lib/api";

interface RoomSession {
  roomId: string;
  title: string;
  role: string;
  participantId: string;
  livekitToken: string;
  slides: string[];
}

interface RoomViewNativeProps {
  session: RoomSession;
  livekitUrl: string;
  participantName: string;
  onEnded: () => void;
}

export function RoomViewNative({
  session,
  livekitUrl,
  participantName,
  onEnded,
}: RoomViewNativeProps) {
  const [connected, setConnected] = useState(false);

  // Start audio session on mount
  useEffect(() => {
    AudioSession.startAudioSession();
    return () => {
      AudioSession.stopAudioSession();
    };
  }, []);

  return (
    <LiveKitRoom
      serverUrl={livekitUrl}
      token={session.livekitToken}
      connect
      audio
      video
      onConnected={() => setConnected(true)}
      onDisconnected={onEnded}
    >
      <RoomContent
        session={session}
        participantName={participantName}
        connected={connected}
        onEnded={onEnded}
      />
    </LiveKitRoom>
  );
}

function RoomContent({
  session,
  participantName,
  connected,
  onEnded,
}: {
  session: RoomSession;
  participantName: string;
  connected: boolean;
  onEnded: () => void;
}) {
  const [showChat, setShowChat] = useState(false);
  const isTeacher = session.role === "teacher";

  const room = useRoomContext();
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);
  const { localParticipant } = useLocalParticipant();
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);

  const toggleMic = useCallback(async () => {
    await localParticipant.setMicrophoneEnabled(!micEnabled);
    setMicEnabled(!micEnabled);
  }, [localParticipant, micEnabled]);

  const toggleCam = useCallback(async () => {
    await localParticipant.setCameraEnabled(!camEnabled);
    setCamEnabled(!camEnabled);
  }, [localParticipant, camEnabled]);

  const handleEndLeave = useCallback(() => {
    if (isTeacher) {
      Alert.alert("End Class", "Are you sure you want to end this class?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "End Class",
          style: "destructive",
          onPress: async () => {
            try {
              const api = createPublicRoomClient();
              await api.roomInternal.endRoom(session.roomId);
            } catch {}
            onEnded();
          },
        },
      ]);
    } else {
      room.disconnect();
      onEnded();
    }
  }, [isTeacher, session.roomId, room, onEnded]);

  if (showChat) {
    return (
      <SafeAreaView className="flex-1 bg-zinc-950">
        {/* Chat header */}
        <View className="flex-row items-center justify-between border-b border-zinc-800 px-4 py-3">
          <Text className="text-base font-semibold text-white">Chat</Text>
          <Pressable onPress={() => setShowChat(false)}>
            <Ionicons name="close" size={24} color="#a1a1aa" />
          </Pressable>
        </View>
        <RoomChatNative
          roomId={session.roomId}
          role={session.role as "teacher" | "student"}
          participantName={participantName}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-zinc-950">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-zinc-800 px-4 py-2">
        <View className="flex-row items-center gap-2">
          <View className="h-7 w-7 items-center justify-center rounded-lg bg-violet-600">
            <Text className="text-xs font-bold text-white">L</Text>
          </View>
          <Text className="text-sm font-semibold text-white" numberOfLines={1}>
            {session.title}
          </Text>
        </View>
        {!connected && (
          <Text className="text-xs text-yellow-400">Connecting...</Text>
        )}
      </View>

      {/* Video grid */}
      <VideoGrid tracks={tracks} />

      {/* Control bar */}
      <View className="flex-row items-center justify-center gap-4 border-t border-zinc-800 px-4 py-3">
        <ControlButton
          icon={micEnabled ? "mic" : "mic-off"}
          active={micEnabled}
          onPress={toggleMic}
        />
        <ControlButton
          icon={camEnabled ? "videocam" : "videocam-off"}
          active={camEnabled}
          onPress={toggleCam}
        />
        <ControlButton
          icon="chatbubble-ellipses"
          active={false}
          onPress={() => setShowChat(true)}
        />
        <Pressable
          onPress={handleEndLeave}
          className="items-center justify-center rounded-full bg-red-600 px-5 py-2.5 active:bg-red-700"
        >
          <Text className="text-sm font-semibold text-white">
            {isTeacher ? "End" : "Leave"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function VideoGrid({ tracks }: { tracks: TrackReference[] }) {
  const { width } = Dimensions.get("window");
  const numColumns = tracks.length <= 1 ? 1 : 2;
  const tileWidth = numColumns === 1 ? width : width / 2;
  const tileHeight = tileWidth * 0.75; // 4:3 aspect ratio

  if (tracks.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <Ionicons name="videocam-off-outline" size={48} color="#52525b" />
        <Text className="mt-2 text-sm text-zinc-500">No video feeds</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={tracks}
      keyExtractor={(item) =>
        `${item.participant.sid}-${item.source}`
      }
      numColumns={numColumns}
      key={numColumns} // force re-render when columns change
      renderItem={({ item }) => (
        <View
          style={{ width: tileWidth, height: tileHeight }}
          className="overflow-hidden border border-zinc-800"
        >
          <VideoTrack
            trackRef={item}
            style={{ flex: 1 }}
            objectFit="cover"
            mirror={
              item.participant.isLocal &&
              item.source === Track.Source.Camera
            }
          />
          <View className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5">
            <Text className="text-[10px] text-white">
              {item.participant.name || item.participant.identity}
            </Text>
          </View>
        </View>
      )}
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
      className="flex-1"
    />
  );
}

function ControlButton({
  icon,
  active,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`items-center justify-center rounded-full p-3 ${
        active ? "bg-zinc-800" : "bg-zinc-700"
      } active:bg-zinc-600`}
    >
      <Ionicons name={icon} size={22} color={active ? "#fff" : "#a1a1aa"} />
    </Pressable>
  );
}
