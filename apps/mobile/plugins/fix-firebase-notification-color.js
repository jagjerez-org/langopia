const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Adds tools:replace="android:resource" to the Firebase messaging
 * default_notification_color meta-data to resolve manifest merger
 * conflict with @react-native-firebase/messaging.
 */
module.exports = function fixFirebaseNotificationColor(config) {
  return withAndroidManifest(config, (config) => {
    const mainApp =
      config.modResults.manifest.application?.[0];
    if (!mainApp) return config;

    const metaData = mainApp["meta-data"] || [];
    for (const entry of metaData) {
      if (
        entry.$?.["android:name"] ===
        "com.google.firebase.messaging.default_notification_color"
      ) {
        entry.$["tools:replace"] = "android:resource";
      }
    }

    return config;
  });
};
