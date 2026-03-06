import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@langopia/api-client";

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    setError(null);

    try {
      await login(email.trim(), password);
      router.replace("/(tabs)");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof TypeError && err.message === "Network request failed") {
        setError("Cannot connect to server. Check your network connection.");
      } else {
        setError(err instanceof Error ? err.message : "Invalid email or password");
      }
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white dark:bg-zinc-900"
    >
      <View className="flex-1 justify-center px-8">
        <View className="mb-8 items-center">
          <Text className="text-3xl font-bold text-zinc-900 dark:text-white">
            Welcome back
          </Text>
          <Text className="mt-2 text-base text-zinc-500 dark:text-zinc-400">
            Sign in to your Langopia account
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
              placeholder="Enter your password"
              secureTextEntry
              autoComplete="password"
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              placeholderTextColor="#a1a1aa"
            />
          </View>

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            className="mt-2 items-center rounded-xl bg-brand-600 py-4 active:bg-brand-700"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-semibold text-white">
                Sign in
              </Text>
            )}
          </Pressable>
        </View>

        <View className="mt-8 flex-row justify-center">
          <Text className="text-sm text-zinc-500 dark:text-zinc-400">
            Don't have an account?{" "}
          </Text>
          <Link href="/(auth)/register" asChild>
            <Pressable>
              <Text className="text-sm font-semibold text-brand-600">
                Sign up
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
