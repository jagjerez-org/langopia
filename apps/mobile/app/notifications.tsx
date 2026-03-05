import { useState, useCallback } from "react";
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
import type { MyNotificationsList, MyNotification } from "@langopia/api-client";

const typeConfig: Record<
  string,
  {
    icon: keyof typeof Ionicons.glyphMap;
    bg: string;
    color: string;
    route?: (data: Record<string, string> | null) => string;
  }
> = {
  class_scheduled: {
    icon: "calendar",
    bg: "#dbeafe",
    color: "#2563eb",
    route: (data) => (data?.classId ? `/classes/${data.classId}` : ""),
  },
  class_cancelled: {
    icon: "calendar-outline",
    bg: "#f4f4f5",
    color: "#71717a",
    route: (data) => (data?.classId ? `/classes/${data.classId}` : ""),
  },
  report_ready: {
    icon: "document-text",
    bg: "#d1fae5",
    color: "#059669",
    route: (data) => (data?.reportId ? `/reports/${data.reportId}` : ""),
  },
};

const defaultConfig = {
  icon: "notifications" as keyof typeof Ionicons.glyphMap,
  bg: "#ede9fe",
  color: "#7c3aed",
};

export default function NotificationsScreen() {
  const api = useApiClient();
  const router = useRouter();

  const {
    data,
    loading,
    refresh,
  } = useCachedQuery<MyNotificationsList>(
    CacheKeys.notifications(),
    () => api.me.notifications(),
  );

  const [localData, setLocalData] = useState<MyNotificationsList | null>(null);
  const displayData = localData ?? data;

  const markRead = useCallback(
    async (id: string) => {
      await api.me.markNotificationRead(id).catch(() => {});
      setLocalData((prev) => {
        const source = prev ?? data;
        if (!source) return prev;
        return {
          ...source,
          unreadCount: Math.max(0, source.unreadCount - 1),
          data: source.data.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          ),
        };
      });
    },
    [api, data],
  );

  const markAllRead = useCallback(async () => {
    await api.me.markAllNotificationsRead().catch(() => {});
    setLocalData((prev) => {
      const source = prev ?? data;
      if (!source) return prev;
      return {
        ...source,
        unreadCount: 0,
        data: source.data.map((n) => ({ ...n, read: true })),
      };
    });
  }, [api, data]);

  // Sync localData when fresh data arrives
  if (data && !localData) {
    // initial load — no-op, use data directly
  }

  return (
    <View className="flex-1 bg-white dark:bg-zinc-900">
      {/* Header actions */}
      {displayData && displayData.unreadCount > 0 && (
        <View className="flex-row items-center justify-end px-4 pb-1 pt-2">
          <Pressable
            onPress={markAllRead}
            className="flex-row items-center gap-1"
          >
            <Ionicons name="checkmark-done" size={16} color="#7c3aed" />
            <Text className="text-xs font-medium text-violet-600">
              Mark all read
            </Text>
          </Pressable>
        </View>
      )}

      {loading && !displayData ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#7c3aed" />
        </View>
      ) : !displayData?.data.length ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="notifications-outline" size={32} color="#d4d4d8" />
          <Text className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            No notifications yet
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, gap: 8 }}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => {
                setLocalData(null);
                refresh();
              }}
              tintColor="#7c3aed"
            />
          }
        >
          {displayData.data.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onPress={(route) => {
                if (!notification.read) markRead(notification.id);
                if (route) router.push(route as any);
              }}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function NotificationRow({
  notification,
  onPress,
}: {
  notification: MyNotification;
  onPress: (route: string) => void;
}) {
  const config = typeConfig[notification.type] ?? defaultConfig;
  const route = (typeConfig[notification.type]?.route?.(notification.data)) || "";

  return (
    <Pressable
      onPress={() => onPress(route)}
      className={`flex-row items-start gap-3 rounded-xl p-4 active:bg-zinc-100 dark:active:bg-zinc-700 ${
        !notification.read
          ? "bg-violet-50 dark:bg-violet-500/10"
          : "bg-zinc-50 dark:bg-zinc-800"
      }`}
    >
      <View
        className="h-9 w-9 items-center justify-center rounded-xl"
        style={{ backgroundColor: config.bg }}
      >
        <Ionicons name={config.icon} size={18} color={config.color} />
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text
            className="flex-shrink font-semibold text-zinc-900 dark:text-white"
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          {!notification.read && (
            <View className="h-2 w-2 rounded-full bg-violet-500" />
          )}
        </View>
        <Text
          className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400"
          numberOfLines={2}
        >
          {notification.body}
        </Text>
        <Text className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
          {formatTimeAgo(notification.createdAt)}
        </Text>
      </View>
      {route ? (
        <Ionicons name="chevron-forward" size={16} color="#d4d4d8" />
      ) : null}
    </Pressable>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
