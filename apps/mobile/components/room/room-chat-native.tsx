import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useDataChannel } from "@livekit/react-native";
import { Ionicons } from "@expo/vector-icons";
import { createPublicRoomClient } from "@/lib/api";

interface ChatMessage {
  id: string;
  senderName: string;
  senderRole: "teacher" | "student";
  message: string;
  createdAt: string;
}

interface RoomChatNativeProps {
  roomId: string;
  role: "teacher" | "student";
  participantName: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function RoomChatNative({
  roomId,
  role,
  participantName,
}: RoomChatNativeProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const api = useMemo(() => createPublicRoomClient(), []);

  const onMessage = useCallback((msg: { payload: Uint8Array }) => {
    try {
      const data = JSON.parse(decoder.decode(msg.payload));
      if (data.type === "chat") {
        setMessages((prev) => [...prev, data.message]);
      }
    } catch {}
  }, []);

  const { send } = useDataChannel("chat", onMessage);

  // Load existing messages
  useEffect(() => {
    api.rooms
      .getChat(roomId)
      .then((data) => {
        if (Array.isArray(data)) setMessages(data as unknown as ChatMessage[]);
      })
      .catch(() => {});
  }, [roomId, api]);

  function handleSend() {
    if (!input.trim()) return;

    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      senderName: participantName,
      senderRole: role,
      message: input.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, msg]);

    // Broadcast via data channel
    const payload = encoder.encode(
      JSON.stringify({ type: "chat", message: msg }),
    );
    send(payload, { reliable: true });

    // Persist to server
    api.roomInternal
      .sendChat(roomId, {
        senderName: msg.senderName,
        senderRole: role,
        message: msg.message,
      })
      .catch(() => {});

    setInput("");
  }

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const nameColor =
      item.senderRole === "teacher" ? "#a78bfa" : "#6ee7b7";

    return (
      <View className="px-3 py-1.5">
        <View className="flex-row items-baseline gap-2">
          <Text style={{ color: nameColor }} className="text-xs font-semibold">
            {item.senderName}
          </Text>
          <Text className="text-[10px] text-zinc-600">
            {new Date(item.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
        <Text className="text-sm text-zinc-300">{item.message}</Text>
      </View>
    );
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-zinc-900"
      keyboardVerticalOffset={0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center p-6">
            <Text className="text-xs text-zinc-600">No messages yet</Text>
          </View>
        }
        className="flex-1"
      />

      {/* Input */}
      <View className="flex-row items-center gap-2 border-t border-zinc-800 px-2 py-2">
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor="#71717a"
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
        />
        <Pressable
          onPress={handleSend}
          disabled={!input.trim()}
          className="rounded-lg bg-violet-600 p-2 active:bg-violet-700 disabled:opacity-30"
        >
          <Ionicons name="send" size={16} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
