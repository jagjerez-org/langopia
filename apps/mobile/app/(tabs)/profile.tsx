import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { useApiClient } from "@/lib/api";
import type { MyAcademyMembership } from "@langopia/api-client";

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const api = useApiClient();
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [academies, setAcademies] = useState<MyAcademyMembership[]>([]);
  const [loadingAcademies, setLoadingAcademies] = useState(true);

  useEffect(() => {
    api.me
      .academies()
      .then(setAcademies)
      .catch(() => {})
      .finally(() => setLoadingAcademies(false));
  }, [api]);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  const saveName = useCallback(async () => {
    if (!name.trim() || name.trim() === user?.name) return;
    setSaving(true);
    try {
      await api.userProfile.update({ name: name.trim() });
      updateUser({ name: name.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }, [api, name, user?.name, updateUser]);

  const canSave = name.trim().length > 0 && name.trim() !== user?.name;

  return (
    <ScrollView className="flex-1 bg-white dark:bg-zinc-900">
      <View className="px-5 pb-8 pt-4">
        {/* Name edit */}
        <View className="rounded-2xl bg-zinc-50 p-5 dark:bg-zinc-800">
          <Text className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Name
          </Text>
          <View className="flex-row gap-2">
            <TextInput
              value={name}
              onChangeText={setName}
              className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
              placeholder="Your name"
              placeholderTextColor="#a1a1aa"
            />
            <Pressable
              onPress={saveName}
              disabled={saving || !canSave}
              className={`items-center justify-center rounded-lg px-4 py-2.5 ${
                canSave && !saving
                  ? "bg-blue-600 active:bg-blue-700"
                  : "bg-zinc-200 dark:bg-zinc-600"
              }`}
            >
              {saved ? (
                <View className="flex-row items-center gap-1">
                  <Ionicons name="checkmark" size={14} color="#fff" />
                  <Text className="text-sm font-medium text-white">Saved</Text>
                </View>
              ) : saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text
                  className={`text-sm font-medium ${
                    canSave ? "text-white" : "text-zinc-400 dark:text-zinc-400"
                  }`}
                >
                  Save
                </Text>
              )}
            </Pressable>
          </View>

          <Text className="mt-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
          </Text>
          <Text className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {user?.email ?? "—"}
          </Text>

          <Text className="mt-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Plan
          </Text>
          <View className="mt-1 self-start rounded-md bg-violet-100 px-2 py-0.5 dark:bg-violet-500/20">
            <Text className="text-xs font-medium capitalize text-violet-700 dark:text-violet-300">
              {user?.plan ?? "—"}
            </Text>
          </View>
        </View>

        {/* Academy memberships */}
        <View className="mt-4 rounded-2xl bg-zinc-50 p-5 dark:bg-zinc-800">
          <Text className="mb-3 font-semibold text-zinc-900 dark:text-white">
            Academy Memberships
          </Text>
          {loadingAcademies ? (
            <ActivityIndicator size="small" color="#7c3aed" />
          ) : academies.length === 0 ? (
            <Text className="text-sm text-zinc-500 dark:text-zinc-400">
              No academy memberships
            </Text>
          ) : (
            <View className="gap-2">
              {academies.map((m) => (
                <View
                  key={m.memberId}
                  className="flex-row items-center justify-between rounded-lg bg-white px-3 py-2.5 dark:bg-zinc-700/40"
                >
                  <View className="flex-row items-center gap-2.5">
                    <View className="h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-500/20">
                      <Ionicons
                        name="business-outline"
                        size={16}
                        color="#7c3aed"
                      />
                    </View>
                    <View>
                      <Text className="text-sm font-medium text-zinc-900 dark:text-white">
                        {m.academy.name}
                      </Text>
                      <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                        {m.academy.academyType}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row gap-1">
                    {m.roles.map((role) => (
                      <View
                        key={role}
                        className="rounded-md border border-zinc-200 px-1.5 py-0.5 dark:border-zinc-600"
                      >
                        <Text className="text-[10px] text-zinc-600 dark:text-zinc-400">
                          {role}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Sign out */}
        <Pressable
          onPress={logout}
          className="mt-6 items-center rounded-xl border border-red-200 bg-red-50 py-4 active:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:active:bg-red-900/40"
        >
          <Text className="text-base font-semibold text-red-600 dark:text-red-400">
            Sign out
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
