const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Packages that require native modules — stub only on web.
const nativeOnlyPackages = [
  "@livekit/react-native",
  "@livekit/react-native-webrtc",
  "@react-native-firebase/app",
  "@react-native-firebase/messaging",
  "expo-notifications",
];

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === "web" &&
    nativeOnlyPackages.some((pkg) => moduleName === pkg || moduleName.startsWith(pkg + "/"))
  ) {
    return { type: "empty" };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
