import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Link } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@langopia/api-client";

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!name || !email || !password || !confirmPassword) return;
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      await register(name.trim(), email.trim(), password);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again.",
      );
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white dark:bg-zinc-900"
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-8 py-12"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-8 items-center">
          <Text className="text-3xl font-bold text-zinc-900 dark:text-white">
            Create an account
          </Text>
          <Text className="mt-2 text-base text-zinc-500 dark:text-zinc-400">
            Get started with Langopia
          </Text>
        </View>

        {error && (
          <View className="mb-4 rounded-xl bg-red-50 px-4 py-3 dark:bg-red-900/20">
            <Text className="text-sm font-medium text-red-600 dark:text-red-400">
              {error}
            </Text>
          </View>
        )}

        <View className="gap-4">
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              autoComplete="name"
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              placeholderTextColor="#a1a1aa"
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              placeholderTextColor="#a1a1aa"
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Password
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              secureTextEntry
              autoComplete="new-password"
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              placeholderTextColor="#a1a1aa"
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Confirm Password
            </Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm your password"
              secureTextEntry
              autoComplete="new-password"
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              placeholderTextColor="#a1a1aa"
            />
          </View>

          <Pressable
            onPress={handleRegister}
            disabled={loading}
            className="mt-2 items-center rounded-xl bg-brand-600 py-4 active:bg-brand-700"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-semibold text-white">
                Create account
              </Text>
            )}
          </Pressable>
        </View>

        <View className="mt-8 flex-row justify-center">
          <Text className="text-sm text-zinc-500 dark:text-zinc-400">
            Already have an account?{" "}
          </Text>
          <Link href="/(auth)/login" asChild>
            <Pressable>
              <Text className="text-sm font-semibold text-brand-600">
                Sign in
              </Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
