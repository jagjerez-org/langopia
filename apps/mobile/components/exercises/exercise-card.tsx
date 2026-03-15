import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ExerciseResponse } from "@langopia/api-client";

const typeIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  warm_up: "flame-outline",
  intro: "book-outline",
  card: "card-outline",
  tap_to_complete: "hand-left-outline",
  tap_to_order: "swap-vertical-outline",
  listen_match: "musical-notes-outline",
  listen_repeat: "mic-outline",
  watch_reflect: "videocam-outline",
  complete_chat: "chatbubbles-outline",
  write_complete: "create-outline",
  listen_complete: "headset-outline",
};

const typeLabels: Record<string, string> = {
  warm_up: "Warm Up",
  intro: "Introduction",
  card: "Concept Card",
  tap_to_complete: "Tap to Complete",
  tap_to_order: "Tap to Order",
  listen_match: "Listen & Match",
  listen_repeat: "Listen & Repeat",
  watch_reflect: "Watch & Reflect",
  complete_chat: "Complete Chat",
  write_complete: "Write to Complete",
  listen_complete: "Listen & Complete",
};

const cefrColors: Record<string, { bg: string; text: string }> = {
  A1: { bg: "#dcfce7", text: "#15803d" },
  A2: { bg: "#d1fae5", text: "#047857" },
  B1: { bg: "#dbeafe", text: "#1d4ed8" },
  B2: { bg: "#e0e7ff", text: "#4338ca" },
  C1: { bg: "#f3e8ff", text: "#7e22ce" },
  C2: { bg: "#fce7f3", text: "#be185d" },
};

interface ExerciseCardProps {
  exercise: ExerciseResponse;
  onPress: () => void;
  index?: number;
}

export function ExerciseCard({ exercise, onPress, index }: ExerciseCardProps) {
  const icon = typeIcons[exercise.type] ?? "help-circle-outline";
  const label = typeLabels[exercise.type] ?? exercise.type;
  const cefr = cefrColors[exercise.cefrLevel] ?? { bg: "#f4f4f5", text: "#52525b" };

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-xl bg-zinc-50 p-4 active:bg-zinc-100 dark:bg-zinc-800 dark:active:bg-zinc-700"
    >
      <View className="mr-3 h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
        <Ionicons name={icon} size={20} color="#2563eb" />
      </View>
      <View className="flex-1 pr-2">
        <View className="flex-row items-center gap-2">
          {index != null && (
            <Text className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
              #{index + 1}
            </Text>
          )}
          <Text
            className="flex-shrink font-semibold text-zinc-900 dark:text-white"
            numberOfLines={1}
          >
            {exercise.title ?? label}
          </Text>
        </View>
        <View className="mt-1 flex-row items-center gap-2">
          <View className="rounded px-1.5 py-0.5" style={{ backgroundColor: "#f0f9ff" }}>
            <Text className="text-[10px] font-medium text-blue-700">{label}</Text>
          </View>
          <View className="rounded px-1.5 py-0.5" style={{ backgroundColor: cefr.bg }}>
            <Text className="text-[10px] font-medium" style={{ color: cefr.text }}>
              {exercise.cefrLevel}
            </Text>
          </View>
          {exercise.targetSkill && (
            <Text className="text-[10px] text-zinc-400 dark:text-zinc-500">
              {exercise.targetSkill}
            </Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#d4d4d8" />
    </Pressable>
  );
}
