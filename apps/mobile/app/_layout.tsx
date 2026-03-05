import "../global.css";
import { registerGlobals } from "@livekit/react-native";

registerGlobals();

import { useEffect, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { useApiClient } from "@/lib/api";
import {
  registerForPushNotifications,
  onTokenRefresh,
  getNotificationRoute,
} from "@/lib/notifications";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const client = useApiClient();
  const notificationListener = useRef<Notifications.EventSubscription>(undefined);

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

  // Register for push notifications when user is logged in
  useEffect(() => {
    if (!user) return;

    registerForPushNotifications(client);

    const unsubTokenRefresh = onTokenRefresh(client);

    // Handle notification taps
    notificationListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as
          | Record<string, string>
          | undefined;
        const route = getNotificationRoute(data);
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
