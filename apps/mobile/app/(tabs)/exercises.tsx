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
import type { MyLessonsList } from "@langopia/api-client";

const cefrTabs = ["All", "A1", "A2", "B1", "B2", "C1", "C2"] as const;

const cefrColors: Record<string, { bg: string; text: string }> = {
  A1: { bg: "#dcfce7", text: "#15803d" },
  A2: { bg: "#d1fae5", text: "#047857" },
  B1: { bg: "#dbeafe", text: "#1d4ed8" },
  B2: { bg: "#e0e7ff", text: "#4338ca" },
  C1: { bg: "#f3e8ff", text: "#7e22ce" },
  C2: { bg: "#fce7f3", text: "#be185d" },
};

export default function ExercisesScreen() {
  const api = useApiClient();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<(typeof cefrTabs)[number]>("All");

  const params = useMemo(
    () => (activeTab === "All" ? undefined : { cefrLevel: activeTab }),
    [activeTab],
  );

  const { data, loading, isStale, refresh } = useCachedQuery<MyLessonsList>(
    CacheKeys.lessons(params as Record<string, unknown> | undefined),
    () => api.me.lessons(params ?? undefined),
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
            No lessons found
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

          {/* Browse all exercises link */}
          <Pressable
            onPress={() => router.push("/exercises")}
            className="mb-2 flex-row items-center justify-between rounded-xl bg-blue-50 p-4 active:bg-blue-100 dark:bg-blue-900/20"
          >
            <View className="flex-row items-center gap-2">
              <Ionicons name="grid-outline" size={20} color="#2563eb" />
              <Text className="font-medium text-blue-700 dark:text-blue-300">
                Browse All Exercises
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#2563eb" />
          </Pressable>

          {/* Lesson list */}
          {data.data.map((lesson) => {
            const cefr = cefrColors[lesson.cefrLevel] ?? {
              bg: "#f4f4f5",
              text: "#52525b",
            };
            return (
              <Pressable
                key={lesson.id}
                onPress={() => router.push(`/lessons/${lesson.id}`)}
                className="flex-row items-center justify-between rounded-xl bg-zinc-50 p-4 active:bg-zinc-100 dark:bg-zinc-800 dark:active:bg-zinc-700"
              >
                <View className="flex-1 pr-3">
                  <View className="flex-row items-center gap-2">
                    <Text
                      className="flex-shrink font-semibold text-zinc-900 dark:text-white"
                      numberOfLines={1}
                    >
                      {lesson.title}
                    </Text>
                    <View
                      className="rounded px-1.5 py-0.5"
                      style={{ backgroundColor: cefr.bg }}
                    >
                      <Text
                        className="text-[10px] font-medium"
                        style={{ color: cefr.text }}
                      >
                        {lesson.cefrLevel}
                      </Text>
                    </View>
                  </View>
                  <Text
                    className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400"
                    numberOfLines={1}
                  >
                    {lesson.exerciseCount} exercise
                    {lesson.exerciseCount !== 1 ? "s" : ""} · {lesson.language}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <View className="rounded-full bg-blue-100 px-2 py-0.5 dark:bg-blue-900/30">
                    <Text className="text-xs font-medium text-blue-700 dark:text-blue-300">
                      {lesson.exerciseCount}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#d4d4d8" />
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
