import type { ExpoConfig } from "expo/config";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const DEFAULT_PRODUCTION_APP_URL = "https://reader.digitalpolyglot.com";

const config: ExpoConfig = {
  name: "Digital Polyglot",
  slug: "digital-polyglot-mobile",
  scheme: "digitalpolyglot",
  version: "0.1.0",
  newArchEnabled: false,
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  assetBundlePatterns: ["**/*"],
  plugins: ["expo-secure-store", "expo-web-browser", "expo-notifications"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.digitalpolyglot.mobile",
    buildNumber: "5",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.digitalpolyglot.mobile",
  },
  extra: {
    clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? "",
    apiBaseUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() ?? DEFAULT_PRODUCTION_APP_URL,
    eas: {
      projectId: "9d9393fb-0f04-43fd-83d1-f33ecd82a74e",
    },
  },
};

export default config;
