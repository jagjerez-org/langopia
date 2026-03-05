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
import { useAuth } from "@/lib/auth-context";
import { useApiClient } from "@/lib/api";
import type { MyStats } from "@langopia/api-client";

export default function HomeScreen() {
  const { user } = useAuth();
  const api = useApiClient();
  const router = useRouter();
  const [stats, setStats] = useState<MyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    api.me
      .stats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
    api.me
      .notifications({ limit: 1 })
      .then((res) => setUnreadCount(res.unreadCount))
      .catch(() => {});
  }, [api]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-zinc-900">
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    );
  }

  const cards = [
    {
      label: "Upcoming",
      value: stats?.upcomingClasses ?? 0,
      icon: "calendar-outline" as const,
      color: "#7c3aed",
    },
    {
      label: "Completed",
      value: stats?.completedClasses ?? 0,
      icon: "checkmark-circle-outline" as const,
      color: "#10b981",
    },
    {
      label: "Reports",
      value: stats?.totalReports ?? 0,
      icon: "document-text-outline" as const,
      color: "#3b82f6",
    },
  ];

  return (
    <ScrollView className="flex-1 bg-white dark:bg-zinc-900">
      <View className="px-5 pb-8 pt-4">
        {/* Greeting */}
        <Text className="text-2xl font-bold text-zinc-900 dark:text-white">
          Hi, {user?.name?.split(" ")[0] ?? "there"}
        </Text>
        <Text className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Here's what's happening with your classes
        </Text>

        {/* Stats cards */}
        <View className="mt-5 flex-row gap-3">
          {cards.map((card) => (
            <View
              key={card.label}
              className="flex-1 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-800"
            >
              <View
                className="mb-2 h-9 w-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: card.color + "20" }}
              >
                <Ionicons name={card.icon} size={18} color={card.color} />
              </View>
              <Text className="text-xl font-bold text-zinc-900 dark:text-white">
                {card.value}
              </Text>
              <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                {card.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Next class card */}
        {stats?.nextClass && (
          <Pressable
            onPress={() => router.push(`/classes/${stats.nextClass!.id}`)}
            className="mt-5 flex-row items-center justify-between rounded-2xl bg-zinc-50 p-4 active:bg-zinc-100 dark:bg-zinc-800 dark:active:bg-zinc-700"
          >
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <Ionicons name="sparkles" size={20} color="#f59e0b" />
              </View>
              <View>
                <Text className="font-semibold text-zinc-900 dark:text-white">
                  {stats.nextClass.title}
                </Text>
                <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                  {new Date(stats.nextClass.scheduledAt).toLocaleDateString(
                    "en-US",
                    {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}{" "}
                  · {stats.nextClass.durationMinutes}min
                </Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color="#a1a1aa"
            />
          </Pressable>
        )}

        {/* Quick links */}
        <View className="mt-5 flex-row gap-3">
          <Pressable
            onPress={() => router.push("/(tabs)/classes")}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-zinc-50 py-3 active:bg-zinc-100 dark:bg-zinc-800 dark:active:bg-zinc-700"
          >
            <Ionicons name="calendar-outline" size={16} color="#71717a" />
            <Text className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Classes
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(tabs)/reports")}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-zinc-50 py-3 active:bg-zinc-100 dark:bg-zinc-800 dark:active:bg-zinc-700"
          >
            <Ionicons name="document-text-outline" size={16} color="#71717a" />
            <Text className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Reports
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/notifications")}
            className="relative flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-zinc-50 py-3 active:bg-zinc-100 dark:bg-zinc-800 dark:active:bg-zinc-700"
          >
            <Ionicons name="notifications-outline" size={16} color="#71717a" />
            <Text className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Alerts
            </Text>
            {unreadCount > 0 && (
              <View className="absolute -right-1 -top-1 h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1">
                <Text className="text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
