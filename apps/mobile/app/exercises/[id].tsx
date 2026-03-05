import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApiClient } from "@/lib/api";
import { useCachedQuery } from "@/lib/use-cached-query";
import { CacheKeys } from "@/lib/cache";
import { ExercisePreview } from "@/components/exercises/exercise-preview";
import { ExerciseTapComplete } from "@/components/exercises/exercise-tap-complete";
import { ExerciseWriteComplete } from "@/components/exercises/exercise-write-complete";
import { ExerciseCompleteChat } from "@/components/exercises/exercise-complete-chat";
import type { ExerciseResponse } from "@langopia/api-client";

export default function ExercisePracticeScreen() {
  const { id, ids, index } = useLocalSearchParams<{
    id: string;
    ids?: string;
    index?: string;
  }>();
  const api = useApiClient();
  const router = useRouter();

  const { data: exercise, loading } = useCachedQuery<ExerciseResponse>(
    CacheKeys.exerciseDetail(id),
    () => api.me.exerciseDetail(id),
    [id],
  );

  // Sequential practice state
  const exerciseIds = ids?.split(",") ?? [];
  const currentIndex = parseInt(index ?? "0", 10);
  const hasNext = currentIndex < exerciseIds.length - 1;

  const goNext = () => {
    if (!hasNext) return;
    const nextIndex = currentIndex + 1;
    const nextId = exerciseIds[nextIndex];
    router.replace(`/exercises/${nextId}?ids=${ids}&index=${nextIndex}`);
  };

  if (loading && !exercise) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-zinc-900">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!exercise) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-zinc-900">
        <Ionicons name="alert-circle-outline" size={32} color="#d4d4d8" />
        <Text className="mt-2 text-sm text-zinc-500">Exercise not found</Text>
      </View>
    );
  }

  const headerTitle = exerciseIds.length > 1
    ? `${currentIndex + 1} / ${exerciseIds.length}`
    : "Exercise";

  return (
    <>
      <Stack.Screen options={{ headerTitle }} />
      <View className="flex-1 bg-white dark:bg-zinc-900">
        {/* Exercise type badge */}
        <View className="flex-row items-center gap-2 px-5 pt-3">
          <View className="rounded-lg bg-blue-50 px-2.5 py-1 dark:bg-blue-900/30">
            <Text className="text-xs font-medium text-blue-700 dark:text-blue-300">
              {exercise.type.replace(/_/g, " ").toUpperCase()}
            </Text>
          </View>
          <View className="rounded-lg bg-zinc-100 px-2.5 py-1 dark:bg-zinc-700">
            <Text className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {exercise.cefrLevel}
            </Text>
          </View>
          {exercise.title && (
            <Text
              className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300"
              numberOfLines={1}
            >
              {exercise.title}
            </Text>
          )}
        </View>

        {/* Exercise component */}
        <View className="flex-1">
          {renderExercise(exercise)}
        </View>

        {/* Next button for sequential mode */}
        {hasNext && (
          <View className="border-t border-zinc-100 p-4 dark:border-zinc-800">
            <Pressable
              onPress={goNext}
              className="flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 py-3"
            >
              <Text className="font-semibold text-white">Next Exercise</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </Pressable>
          </View>
        )}
      </View>
    </>
  );
}

function renderExercise(exercise: ExerciseResponse) {
  switch (exercise.type) {
    case "tap_to_complete":
      return <ExerciseTapComplete exercise={exercise} />;
    case "write_complete":
    case "listen_complete":
      return <ExerciseWriteComplete exercise={exercise} />;
    case "complete_chat":
      return <ExerciseCompleteChat exercise={exercise} />;
    default:
      return <ExercisePreview exercise={exercise} />;
  }
}
