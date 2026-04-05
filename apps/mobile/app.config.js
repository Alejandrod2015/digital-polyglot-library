const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const DEFAULT_PRODUCTION_APP_URL = "https://reader.digitalpolyglot.com";
const DEFAULT_PRODUCTION_CLERK_PUBLISHABLE_KEY = "pk_live_Y2xlcmsuZGlnaXRhbHBvbHlnbG90LmNvbSQ";
const deviceApiBaseUrl = process.env.EXPO_PUBLIC_DEVICE_API_BASE_URL?.trim() ?? "";
const buildProfile = process.env.EAS_BUILD_PROFILE?.trim().toLowerCase() ?? "";
const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase() ?? "";
const xcodeConfiguration = process.env.CONFIGURATION?.trim().toLowerCase() ?? "";
const appVariant = process.env.APP_VARIANT?.trim().toLowerCase() ?? "";
const isProductionBuild =
  buildProfile === "production" ||
  nodeEnv === "production" ||
  xcodeConfiguration === "release" ||
  appVariant === "production";

function resolveApiBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  if (!raw) {
    return DEFAULT_PRODUCTION_APP_URL;
  }

  try {
    const url = new URL(raw);
    const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (isProductionBuild && isLocalhost) {
      return DEFAULT_PRODUCTION_APP_URL;
    }
    return raw;
  } catch {
    return isProductionBuild ? DEFAULT_PRODUCTION_APP_URL : raw;
  }
}

function resolveClerkPublishableKey(apiBaseUrl) {
  const raw = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? "";
  const targetApiBaseUrl = deviceApiBaseUrl || apiBaseUrl;
  const isProductionApi = targetApiBaseUrl === DEFAULT_PRODUCTION_APP_URL || isProductionBuild;
  const isTestKey = raw.startsWith("pk_test_") || raw.startsWith("test_");

  if (isProductionApi && (!raw || isTestKey)) {
    return DEFAULT_PRODUCTION_CLERK_PUBLISHABLE_KEY;
  }

  return raw;
}

const apiBaseUrl = resolveApiBaseUrl();
const clerkPublishableKey = resolveClerkPublishableKey(apiBaseUrl);

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: "Digital Polyglot",
  slug: "digital-polyglot-mobile",
  scheme: "digitalpolyglot",
  version: "0.1.0",
  newArchEnabled: false,
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  assetBundlePatterns: ["**/*"],
  plugins: [
    "expo-secure-store",
    "expo-web-browser",
    "expo-notifications",
    "./plugins/without-apple-signin",
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.digitalpolyglot.mobile",
    buildNumber: "29",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.digitalpolyglot.mobile",
  },
  extra: {
    clerkPublishableKey,
    apiBaseUrl,
    EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID:
      process.env.EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID?.trim() ?? "",
    EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID:
      process.env.EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID?.trim() ?? "",
    eas: {
      projectId: "9d9393fb-0f04-43fd-83d1-f33ecd82a74e",
    },
  },
};

module.exports = config;
