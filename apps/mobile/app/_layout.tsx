import "../global.css";
import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

if (Platform.OS !== "web" && !isExpoGo) {
  try {
    require("@livekit/react-native").registerGlobals();
  } catch {
    // LiveKit native module not available — skip
  }
}

import { useEffect, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { useApiClient } from "@/lib/api";

let Notifications: typeof import("expo-notifications") | null = null;
let notificationsLib: typeof import("@/lib/notifications") | null = null;
if (Platform.OS !== "web" && !isExpoGo) {
  Notifications = require("expo-notifications");
  notificationsLib = require("@/lib/notifications");
}

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const client = useApiClient();
  const notificationListener = useRef<any>(undefined);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments]);

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [loading]);

  // Register for push notifications when user is logged in (native only)
  useEffect(() => {
    if (!user || !Notifications || !notificationsLib) return;

    notificationsLib.registerForPushNotifications(client);

    const unsubTokenRefresh = notificationsLib.onTokenRefresh(client);

    notificationListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as
          | Record<string, string>
          | undefined;
        const route = notificationsLib!.getNotificationRoute(data);
        if (route) {
          router.push(route as any);
        }
      });

    return () => {
      unsubTokenRefresh();
      notificationListener.current?.remove();
    };
  }, [user]);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="classes/[id]"
          options={{
            headerShown: true,
            headerTitle: "Class Details",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="reports/[id]"
          options={{
            headerShown: true,
            headerTitle: "Report Details",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="lessons/[id]"
          options={{
            headerShown: true,
            headerTitle: "Lesson",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="exercises/index"
          options={{
            headerShown: true,
            headerTitle: "All Exercises",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="exercises/[id]"
          options={{
            headerShown: true,
            headerTitle: "Exercise",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="notifications"
          options={{
            headerShown: true,
            headerTitle: "Notifications",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="room/[token]"
          options={{
            headerShown: false,
            presentation: "fullScreenModal",
            gestureEnabled: false,
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
