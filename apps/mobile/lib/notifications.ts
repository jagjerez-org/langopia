import * as Notifications from "expo-notifications";
import messaging from "@react-native-firebase/messaging";
import { Platform } from "react-native";
import type { LangopiaClient } from "@langopia/api-client";

// Show notifications when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Request push notification permissions, get FCM token, and register with backend.
 */
export async function registerForPushNotifications(
  client: LangopiaClient,
): Promise<void> {
  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) return;

    const token = await messaging().getToken();
    if (!token) return;

    const platform = Platform.OS === "ios" ? "ios" : "android";

    await client.userProfile.registerPushToken({ token, platform });
  } catch (err) {
    console.warn("Failed to register for push notifications:", err);
  }
}

/**
 * Unregister the current FCM token from the backend.
 */
export async function unregisterPushToken(
  client: LangopiaClient,
): Promise<void> {
  try {
    const token = await messaging().getToken();
    if (token) {
      await client.userProfile.unregisterPushToken({ token });
    }
  } catch {
    // Best-effort — don't block logout
  }
}

/**
 * Listen for FCM token refreshes and re-register with backend.
 */
export function onTokenRefresh(client: LangopiaClient): () => void {
  return messaging().onTokenRefresh(async (token) => {
    try {
      const platform = Platform.OS === "ios" ? "ios" : "android";
      await client.userProfile.registerPushToken({ token, platform });
    } catch {
      // Best-effort
    }
  });
}

/**
 * Map notification data to an app route for deep linking.
 */
export function getNotificationRoute(
  data: Record<string, string> | undefined,
): string | null {
  if (!data?.type) return null;

  switch (data.type) {
    case "class_scheduled":
    case "class_cancelled":
      return data.classId ? `/classes/${data.classId}` : null;
    case "report_ready":
      return data.reportId ? `/reports/${data.reportId}` : null;
    default:
      return null;
  }
}
