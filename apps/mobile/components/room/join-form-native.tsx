import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface JoinFormNativeProps {
  isTeacher: boolean;
  initialName?: string;
  joining: boolean;
  error: string | null;
  onJoin: (name: string, email?: string) => void;
}

export function JoinFormNative({
  isTeacher,
  initialName,
  joining,
  error,
  onJoin,
}: JoinFormNativeProps) {
  const [name, setName] = useState(initialName ?? "");
  const [email, setEmail] = useState("");

  function handleSubmit() {
    if (!name.trim()) return;
    if (!isTeacher && !email.trim()) return;
    onJoin(name.trim(), isTeacher ? undefined : email.trim());
  }

  const canSubmit =
    name.trim().length > 0 && (isTeacher || email.trim().length > 0);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-zinc-950"
    >
      <View className="flex-1 items-center justify-center px-6">
        {/* Icon */}
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-violet-600">
          <Ionicons
            name={isTeacher ? "school" : "people"}
            size={32}
            color="#fff"
          />
        </View>

        <Text className="text-2xl font-bold text-white">
          {isTeacher ? "Join as Teacher" : "Join Class"}
        </Text>
        <Text className="mt-1 text-sm text-zinc-400">
          {isTeacher
            ? "Enter your name to start the class"
            : "Enter your details to join the class"}
        </Text>

        {/* Form */}
        <View className="mt-8 w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
          <Text className="mb-1.5 text-sm font-medium text-zinc-300">
            Name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor="#71717a"
            autoFocus
            editable={!joining}
            className="mb-4 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-base text-white"
          />

          {!isTeacher && (
            <>
              <Text className="mb-1.5 text-sm font-medium text-zinc-300">
                Email
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor="#71717a"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!joining}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-base text-white"
              />
              <Text className="mt-1 mb-4 text-xs text-zinc-500">
                Used to track your progress across sessions
              </Text>
            </>
          )}

          {error && (
            <View className="mb-4 rounded-lg border border-red-800 bg-red-900/20 px-3 py-2">
              <Text className="text-sm text-red-400">{error}</Text>
            </View>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={joining || !canSubmit}
            className="mt-2 items-center rounded-lg bg-violet-600 py-3 active:bg-violet-700 disabled:opacity-50"
          >
            {joining ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="text-base font-semibold text-white">
                Join Room
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
