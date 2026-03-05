import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApiClient } from "@/lib/api";
import type { MyClassDetail } from "@langopia/api-client";

const statusColors: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: "#dbeafe", text: "#1d4ed8" },
  confirmed: { bg: "#dbeafe", text: "#1d4ed8" },
  in_progress: { bg: "#fef3c7", text: "#b45309" },
  completed: { bg: "#d1fae5", text: "#047857" },
  cancelled: { bg: "#f4f4f5", text: "#52525b" },
};

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const api = useApiClient();
  const [cls, setCls] = useState<MyClassDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.me
      .classDetail(id)
      .then(setCls)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api, id]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-zinc-900">
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    );
  }

  if (!cls) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-zinc-900">
        <Text className="text-zinc-500 dark:text-zinc-400">
          Class not found
        </Text>
      </View>
    );
  }

  const canEnter =
    cls.status === "scheduled" ||
    cls.status === "confirmed" ||
    cls.status === "in_progress";
  const colors = statusColors[cls.status] ?? statusColors.scheduled;

  return (
    <ScrollView className="flex-1 bg-white dark:bg-zinc-900">
      <View className="px-5 pb-8 pt-4">
        {/* Header */}
        <View className="rounded-2xl bg-zinc-50 p-5 dark:bg-zinc-800">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-xl font-bold text-zinc-900 dark:text-white">
                {cls.title}
              </Text>
              <Text className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                {cls.academyName}
              </Text>
            </View>
            <View
              className="rounded-md px-2 py-1"
              style={{ backgroundColor: colors.bg }}
            >
              <Text
                className="text-xs font-medium"
                style={{ color: colors.text }}
              >
                {cls.status}
              </Text>
            </View>
          </View>

          {cls.description && (
            <Text className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              {cls.description}
            </Text>
          )}

          {/* Info grid */}
          <View className="mt-4 flex-row flex-wrap gap-3">
            <InfoItem icon="calendar-outline" label="Scheduled">
              {new Date(cls.scheduledAt).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </InfoItem>
            <InfoItem icon="time-outline" label="Duration">
              {cls.durationMinutes} minutes
            </InfoItem>
            <InfoItem icon="globe-outline" label="Language">
              {cls.language.toUpperCase()}
            </InfoItem>
            <InfoItem icon="people-outline" label="Type">
              {cls.classType} (max {cls.maxStudents})
            </InfoItem>
          </View>

          {cls.lesson && (
            <View className="mt-3 flex-row items-center gap-2">
              <Ionicons name="book-outline" size={16} color="#71717a" />
              <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                Lesson:
              </Text>
              <Text className="text-sm font-medium text-zinc-900 dark:text-white">
                {cls.lesson.title}
              </Text>
            </View>
          )}

          {canEnter && (
            <Pressable
              onPress={() => {
                const match = cls.teacherUrl.match(/[?&]token=([^&]+)/);
                if (match?.[1]) {
                  router.push(`/room/${encodeURIComponent(match[1])}`);
                }
              }}
              className="mt-5 flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 active:bg-blue-700"
            >
              <Ionicons name="videocam" size={18} color="#fff" />
              <Text className="text-base font-semibold text-white">
                Enter Classroom
              </Text>
            </Pressable>
          )}
        </View>

        {/* Students */}
        {cls.students.length > 0 && (
          <View className="mt-4 rounded-2xl bg-zinc-50 p-5 dark:bg-zinc-800">
            <Text className="mb-3 font-semibold text-zinc-900 dark:text-white">
              Students ({cls.students.length})
            </Text>
            <View className="gap-2">
              {cls.students.map((s) => (
                <View
                  key={s.id}
                  className="flex-row items-center justify-between rounded-lg bg-white px-3 py-2 dark:bg-zinc-700/40"
                >
                  <View>
                    <Text className="text-sm font-medium text-zinc-900 dark:text-white">
                      {s.name}
                    </Text>
                    <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                      {s.email}
                    </Text>
                  </View>
                  <View className="rounded-md border border-zinc-200 px-1.5 py-0.5 dark:border-zinc-600">
                    <Text className="text-[10px] text-zinc-600 dark:text-zinc-400">
                      {s.status}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function InfoItem({
  icon,
  label,
  children,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="w-[47%] flex-row items-start gap-2">
      <Ionicons
        name={icon}
        size={16}
        color="#71717a"
        style={{ marginTop: 2 }}
      />
      <View>
        <Text className="text-xs text-zinc-500 dark:text-zinc-400">
          {label}
        </Text>
        <Text className="text-sm font-medium text-zinc-900 dark:text-white">
          {children}
        </Text>
      </View>
    </View>
  );
}
