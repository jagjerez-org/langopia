import { useEffect, useState, useCallback } from "react";
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
import type { MyClassesList } from "@langopia/api-client";

const statusTabs = [
  { label: "Upcoming", value: "scheduled" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
] as const;

const statusColors: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: "#dbeafe", text: "#1d4ed8" },
  confirmed: { bg: "#dbeafe", text: "#1d4ed8" },
  in_progress: { bg: "#fef3c7", text: "#b45309" },
  completed: { bg: "#d1fae5", text: "#047857" },
  cancelled: { bg: "#f4f4f5", text: "#52525b" },
};

export default function ClassesScreen() {
  const api = useApiClient();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("scheduled");
  const [data, setData] = useState<MyClassesList | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.me
      .classes({ status: activeTab })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api, activeTab]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View className="flex-1 bg-white dark:bg-zinc-900">
      {/* Status tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="max-h-12 bg-zinc-100 dark:bg-zinc-800/60"
        contentContainerStyle={{ padding: 4, gap: 4 }}
      >
        {statusTabs.map((tab) => (
          <Pressable
            key={tab.value}
            onPress={() => setActiveTab(tab.value)}
            className={`rounded-lg px-4 py-2 ${
              activeTab === tab.value
                ? "bg-white shadow-sm dark:bg-zinc-700"
                : ""
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                activeTab === tab.value
                  ? "text-zinc-900 dark:text-white"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Class list */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#7c3aed" />
        </View>
      ) : !data?.data.length ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="calendar-outline" size={32} color="#d4d4d8" />
          <Text className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            No classes found
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 8 }}>
          {data.data.map((cls) => {
            const colors = statusColors[cls.status] ?? statusColors.scheduled;
            return (
              <Pressable
                key={cls.id}
                onPress={() => router.push(`/classes/${cls.id}`)}
                className="flex-row items-center justify-between rounded-xl bg-zinc-50 p-4 active:bg-zinc-100 dark:bg-zinc-800 dark:active:bg-zinc-700"
              >
                <View className="flex-1 pr-3">
                  <View className="flex-row items-center gap-2">
                    <Text
                      className="flex-shrink font-semibold text-zinc-900 dark:text-white"
                      numberOfLines={1}
                    >
                      {cls.title}
                    </Text>
                    <View
                      className="rounded-md px-1.5 py-0.5"
                      style={{ backgroundColor: colors.bg }}
                    >
                      <Text
                        className="text-[10px] font-medium"
                        style={{ color: colors.text }}
                      >
                        {cls.status}
                      </Text>
                    </View>
                  </View>
                  <Text
                    className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400"
                    numberOfLines={1}
                  >
                    {new Date(cls.scheduledAt).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {cls.durationMinutes}min · {cls.academyName}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#d4d4d8" />
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
