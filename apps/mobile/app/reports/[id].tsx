import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApiClient } from "@/lib/api";
import type { MyReportDetail } from "@langopia/api-client";

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApiClient();
  const [report, setReport] = useState<MyReportDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.me
      .reportDetail(id)
      .then(setReport)
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

  if (!report) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-zinc-900">
        <Text className="text-zinc-500 dark:text-zinc-400">
          Report not found
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white dark:bg-zinc-900">
      <View className="px-5 pb-8 pt-4">
        {/* Header */}
        <View className="rounded-2xl bg-zinc-50 p-5 dark:bg-zinc-800">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-xl font-bold text-zinc-900 dark:text-white">
                {report.class.title}
              </Text>
              <Text className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                {report.academyName} ·{" "}
                {new Date(report.class.scheduledAt).toLocaleDateString(
                  "en-US",
                  { weekday: "short", month: "short", day: "numeric" },
                )}
              </Text>
            </View>
            <View className="rounded-md bg-zinc-200 px-2 py-1 dark:bg-zinc-600">
              <Text className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {report.status}
              </Text>
            </View>
          </View>

          {report.summary && (
            <Text className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              {report.summary}
            </Text>
          )}

          <View className="mt-4 flex-row gap-4">
            <View className="flex-row items-center gap-1">
              <Ionicons name="time-outline" size={14} color="#71717a" />
              <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                {report.classDuration}min
              </Text>
            </View>
            {report.teacher && (
              <View className="flex-row items-center gap-1">
                <Ionicons name="mic-outline" size={14} color="#71717a" />
                <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                  Teacher spoke{" "}
                  {Math.round(report.teacher.speakingRatio * 100)}%
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Student breakdowns */}
        {report.studentReports.map((sr) => (
          <View
            key={sr.studentId}
            className="mt-4 rounded-2xl bg-zinc-50 p-5 dark:bg-zinc-800"
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="font-semibold text-zinc-900 dark:text-white">
                  {sr.name}
                </Text>
                <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                  {sr.email}
                </Text>
              </View>
              <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                Spoke {Math.round(sr.speakingRatio * 100)}% ·{" "}
                {sr.fillerWords} fillers
              </Text>
            </View>

            {/* Vocabulary */}
            {sr.vocabulary.length > 0 && (
              <View className="mt-3">
                <View className="mb-1.5 flex-row items-center gap-1">
                  <Ionicons name="book-outline" size={12} color="#71717a" />
                  <Text className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                    Vocabulary ({sr.vocabulary.length})
                  </Text>
                </View>
                <View className="flex-row flex-wrap gap-1.5">
                  {sr.vocabulary.map((v, i) => (
                    <View
                      key={i}
                      className="rounded-md bg-violet-100 px-2 py-0.5 dark:bg-violet-500/10"
                    >
                      <Text className="text-xs text-violet-700 dark:text-violet-300">
                        {v.word}{" "}
                        <Text className="text-[10px] opacity-70">
                          {v.cefrLevel}
                        </Text>
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Grammar errors */}
            {sr.grammarErrors.length > 0 && (
              <View className="mt-3">
                <View className="mb-1.5 flex-row items-center gap-1">
                  <Ionicons
                    name="alert-circle-outline"
                    size={12}
                    color="#71717a"
                  />
                  <Text className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                    Grammar ({sr.grammarErrors.length})
                  </Text>
                </View>
                <View className="gap-1.5">
                  {sr.grammarErrors.map((g, i) => (
                    <View
                      key={i}
                      className="rounded-lg bg-red-50 p-2.5 dark:bg-red-500/10"
                    >
                      <Text className="text-xs text-zinc-800 dark:text-zinc-200">
                        <Text className="text-red-600 line-through dark:text-red-400">
                          {g.text}
                        </Text>
                        {"  →  "}
                        <Text className="font-medium text-emerald-600 dark:text-emerald-400">
                          {g.correction}
                        </Text>
                      </Text>
                      <Text className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {g.explanation}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Homework suggestions */}
            {sr.homeworkSuggestions.length > 0 && (
              <View className="mt-3">
                <View className="mb-1.5 flex-row items-center gap-1">
                  <Ionicons name="bulb-outline" size={12} color="#71717a" />
                  <Text className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                    Homework Suggestions
                  </Text>
                </View>
                <View className="gap-0.5">
                  {sr.homeworkSuggestions.map((h, i) => (
                    <Text
                      key={i}
                      className="text-xs text-zinc-600 dark:text-zinc-400"
                    >
                      • {h}
                    </Text>
                  ))}
                </View>
              </View>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
