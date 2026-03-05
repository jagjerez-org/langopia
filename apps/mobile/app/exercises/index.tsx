import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApiClient } from "@/lib/api";
import { useCachedQuery } from "@/lib/use-cached-query";
import { CacheKeys } from "@/lib/cache";
import { ExerciseCard } from "@/components/exercises/exercise-card";
import type { MyExercisesList } from "@langopia/api-client";

const cefrTabs = ["All", "A1", "A2", "B1", "B2", "C1", "C2"] as const;

export default function AllExercisesScreen() {
  const api = useApiClient();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<(typeof cefrTabs)[number]>("All");

  const params = useMemo(
    () => (activeTab === "All" ? undefined : { cefrLevel: activeTab }),
    [activeTab],
  );

  const { data, loading, isStale, refresh } = useCachedQuery<MyExercisesList>(
    CacheKeys.exercises(params as Record<string, unknown> | undefined),
    () => api.me.exercises(params ?? undefined),
    [activeTab],
  );

  return (
    <View className="flex-1 bg-white dark:bg-zinc-900">
      {/* CEFR filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="max-h-12 bg-zinc-100 dark:bg-zinc-800/60"
        contentContainerStyle={{ padding: 4, gap: 4 }}
      >
        {cefrTabs.map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            className={`rounded-lg px-4 py-2 ${
              activeTab === tab
                ? "bg-white shadow-sm dark:bg-zinc-700"
                : ""
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                activeTab === tab
                  ? "text-zinc-900 dark:text-white"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Content */}
      {loading && !data ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : !data?.data.length ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="school-outline" size={32} color="#d4d4d8" />
          <Text className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            No exercises found
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, gap: 8 }}
          refreshControl={
            <RefreshControl refreshing={loading && !!data} onRefresh={refresh} />
          }
        >
          {isStale && (
            <Text className="mb-1 text-center text-xs text-zinc-400">
              Showing cached data
            </Text>
          )}
          {data.data.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              onPress={() => router.push(`/exercises/${exercise.id}`)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
