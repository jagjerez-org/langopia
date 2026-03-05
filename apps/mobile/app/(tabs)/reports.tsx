import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApiClient } from "@/lib/api";
import type { MyReportsList } from "@langopia/api-client";

export default function ReportsScreen() {
  const api = useApiClient();
  const router = useRouter();
  const [data, setData] = useState<MyReportsList | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me
      .reports()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-zinc-900">
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    );
  }

  if (!data?.data.length) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8 dark:bg-zinc-900">
        <Ionicons name="document-text-outline" size={32} color="#d4d4d8" />
        <Text className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          No reports yet
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-zinc-900"
      contentContainerStyle={{ padding: 16, gap: 8 }}
    >
      {data.data.map((report) => (
        <Pressable
          key={report.id}
          onPress={() => router.push(`/reports/${report.id}`)}
          className="flex-row items-center justify-between rounded-xl bg-zinc-50 p-4 active:bg-zinc-100 dark:bg-zinc-800 dark:active:bg-zinc-700"
        >
          <View className="flex-1 pr-3">
            <View className="flex-row items-center gap-2">
              <Text
                className="flex-shrink font-semibold text-zinc-900 dark:text-white"
                numberOfLines={1}
              >
                {report.class?.title ?? "Untitled"}
              </Text>
              <View className="rounded-md bg-zinc-200 px-1.5 py-0.5 dark:bg-zinc-600">
                <Text className="text-[10px] font-medium text-zinc-700 dark:text-zinc-300">
                  {report.status}
                </Text>
              </View>
            </View>
            <View className="mt-0.5 flex-row items-center gap-3">
              {report.class && (
                <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                  {new Date(report.class.scheduledAt).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric" },
                  )}
                </Text>
              )}
              <View className="flex-row items-center gap-1">
                <Ionicons name="people-outline" size={12} color="#71717a" />
                <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                  {report.studentCount}
                </Text>
              </View>
              {report.classDuration > 0 && (
                <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                  {report.classDuration}min
                </Text>
              )}
            </View>
            {report.summary && (
              <Text
                className="mt-1 text-xs text-zinc-500"
                numberOfLines={1}
              >
                {report.summary}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color="#d4d4d8" />
        </Pressable>
      ))}
    </ScrollView>
  );
}
