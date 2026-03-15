import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApiClient } from "@/lib/api";
import { useCachedQuery } from "@/lib/use-cached-query";
import { CacheKeys } from "@/lib/cache";
import { ExerciseCard } from "@/components/exercises/exercise-card";
import type { MyLessonDetail } from "@langopia/api-client";

const cefrColors: Record<string, { bg: string; text: string }> = {
  A1: { bg: "#dcfce7", text: "#15803d" },
  A2: { bg: "#d1fae5", text: "#047857" },
  B1: { bg: "#dbeafe", text: "#1d4ed8" },
  B2: { bg: "#e0e7ff", text: "#4338ca" },
  C1: { bg: "#f3e8ff", text: "#7e22ce" },
  C2: { bg: "#fce7f3", text: "#be185d" },
};

export default function LessonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApiClient();
  const router = useRouter();

  const { data: lesson, loading } = useCachedQuery<MyLessonDetail>(
    CacheKeys.lessonDetail(id),
    () => api.me.lessonDetail(id),
    [id],
  );

  if (loading && !lesson) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-zinc-900">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!lesson) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-zinc-900">
        <Ionicons name="alert-circle-outline" size={32} color="#d4d4d8" />
        <Text className="mt-2 text-sm text-zinc-500">Lesson not found</Text>
      </View>
    );
  }

  const cefr = cefrColors[lesson.cefrLevel] ?? { bg: "#f4f4f5", text: "#52525b" };
  const exerciseIds = lesson.exercises.map((e) => e.id);

  return (
    <>
      <Stack.Screen options={{ headerTitle: lesson.title }} />
      <ScrollView
        className="flex-1 bg-white dark:bg-zinc-900"
        contentContainerStyle={{ padding: 16, gap: 16 }}
      >
        {/* Lesson info */}
        <View className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800">
          <Text className="text-lg font-bold text-zinc-900 dark:text-white">
            {lesson.title}
          </Text>
          {lesson.description && (
            <Text className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {lesson.description}
            </Text>
          )}
          <View className="mt-3 flex-row gap-2">
            <View
              className="rounded px-2 py-0.5"
              style={{ backgroundColor: cefr.bg }}
            >
              <Text
                className="text-xs font-medium"
                style={{ color: cefr.text }}
              >
                {lesson.cefrLevel}
              </Text>
            </View>
            <View className="rounded bg-zinc-200 px-2 py-0.5 dark:bg-zinc-600">
              <Text className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                {lesson.language}
              </Text>
            </View>
            <View className="rounded bg-zinc-200 px-2 py-0.5 dark:bg-zinc-600">
              <Text className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                {lesson.exercises.length} exercise
                {lesson.exercises.length !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>
        </View>

        {/* Practice All button */}
        {lesson.exercises.length > 0 && (
          <Pressable
            onPress={() =>
              router.push(
                `/exercises/${exerciseIds[0]}?ids=${exerciseIds.join(",")}&index=0`,
              )
            }
            className="flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 py-3"
          >
            <Ionicons name="play" size={18} color="#fff" />
            <Text className="font-semibold text-white">Practice All</Text>
          </Pressable>
        )}

        {/* Exercise list */}
        <View className="gap-2">
          {lesson.exercises.map((exercise, index) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              index={index}
              onPress={() =>
                router.push(
                  `/exercises/${exercise.id}?ids=${exerciseIds.join(",")}&index=${index}`,
                )
              }
            />
          ))}
        </View>
      </ScrollView>
    </>
  );
}
