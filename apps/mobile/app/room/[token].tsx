import { useState, lazy, Suspense } from "react";
import { View, Text, Pressable, SafeAreaView, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ApiError } from "@langopia/api-client";
import { useAuth } from "@/lib/auth-context";
import { createPublicRoomClient } from "@/lib/api";
import { JoinFormNative } from "@/components/room/join-form-native";

// Lazy-load to avoid importing @livekit/react-native at module evaluation time
// (Expo Router eagerly loads all route modules)
const RoomViewNative = lazy(() =>
  import("@/components/room/room-view-native").then((m) => ({
    default: m.RoomViewNative,
  })),
);

/** Actual shape returned by the NestJS API (superset of api-client type) */
interface RoomSession {
  roomId: string;
  title: string;
  language: string;
  role: string;
  participantId: string;
  livekitToken: string;
  livekitUrl: string;
  slides: string[];
  status: string;
}

type RoomPhase = "joining" | "in_room" | "ended" | "error";

export default function RoomScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [phase, setPhase] = useState<RoomPhase>("joining");
  const [session, setSession] = useState<RoomSession | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState("");

  const isTeacher = token?.startsWith("t_") ?? false;

  async function handleJoin(name: string, email?: string) {
    if (!token) return;
    setJoining(true);
    setError(null);

    try {
      const api = createPublicRoomClient();
      const data = await api.roomInternal.join({ token, name, email });
      setSession(data as unknown as RoomSession);
      setParticipantName(name);
      setPhase("in_room");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to connect to the server",
      );
    } finally {
      setJoining(false);
    }
  }

  if (!token) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-zinc-950">
        <Ionicons name="warning-outline" size={48} color="#ef4444" />
        <Text className="mt-4 text-xl font-bold text-white">
          Invalid Room Link
        </Text>
        <Text className="mt-1 text-sm text-zinc-400">
          This link is missing a valid access token.
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-6 rounded-lg bg-zinc-800 px-6 py-2.5 active:bg-zinc-700"
        >
          <Text className="font-medium text-white">Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (phase === "joining") {
    return (
      <JoinFormNative
        isTeacher={isTeacher}
        initialName={isTeacher ? user?.name : undefined}
        joining={joining}
        error={error}
        onJoin={handleJoin}
      />
    );
  }

  if (phase === "in_room" && session) {
    return (
      <Suspense
        fallback={
          <SafeAreaView className="flex-1 items-center justify-center bg-zinc-950">
            <ActivityIndicator size="large" color="#7c3aed" />
            <Text className="mt-4 text-white">Loading room...</Text>
          </SafeAreaView>
        }
      >
        <RoomViewNative
          session={session}
          livekitUrl={session.livekitUrl}
          participantName={participantName}
          onEnded={() => setPhase("ended")}
        />
      </Suspense>
    );
  }

  if (phase === "ended") {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-zinc-950">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-violet-600">
          <Ionicons name="checkmark" size={32} color="#fff" />
        </View>
        <Text className="mt-4 text-2xl font-bold text-white">Class Ended</Text>
        <Text className="mt-1 text-sm text-zinc-400">
          Thank you for attending!
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-6 rounded-lg bg-violet-600 px-6 py-2.5 active:bg-violet-700"
        >
          <Text className="font-medium text-white">Close</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // Error fallback
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-zinc-950">
      <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
      <Text className="mt-4 text-xl font-bold text-white">
        Something went wrong
      </Text>
      <Text className="mt-1 text-center text-sm text-zinc-400 px-8">
        {error ?? "An unexpected error occurred."}
      </Text>
      <Pressable
        onPress={() => router.back()}
        className="mt-6 rounded-lg bg-zinc-800 px-6 py-2.5 active:bg-zinc-700"
      >
        <Text className="font-medium text-white">Go Back</Text>
      </Pressable>
    </SafeAreaView>
  );
}
