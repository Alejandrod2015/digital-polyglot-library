import Constants from "expo-constants";
import * as Device from "expo-device";

type ExtraConfig = {
  clerkPublishableKey?: string;
  apiBaseUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;
const DEFAULT_PRODUCTION_APP_URL = "https://reader.digitalpolyglot.com";
const DEFAULT_PRODUCTION_CLERK_PUBLISHABLE_KEY = "pk_live_Y2xlcmsuZGlnaXRhbHBvbHlnbG90LmNvbSQ";
const envApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? "";
const envDeviceApiBaseUrl = process.env.EXPO_PUBLIC_DEVICE_API_BASE_URL?.trim() ?? "";

function normalizeApiBaseUrl(value: string): string {
  try {
    const url = new URL(value);
    const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.hostname === "localhost") {
      url.hostname = "127.0.0.1";
    }
    if (Device.isDevice && isLocalhost) {
      return envDeviceApiBaseUrl || DEFAULT_PRODUCTION_APP_URL;
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim() || DEFAULT_PRODUCTION_APP_URL;
  }
}

const resolvedApiBaseUrl = normalizeApiBaseUrl(envApiBaseUrl || extra.apiBaseUrl?.trim() || DEFAULT_PRODUCTION_APP_URL);

function resolveClerkPublishableKey(): string {
  const raw = extra.clerkPublishableKey?.trim() ?? "";
  const isProductionApi = resolvedApiBaseUrl === DEFAULT_PRODUCTION_APP_URL;
  const isTestKey = raw.startsWith("pk_test_") || raw.startsWith("test_");

  if (isProductionApi && (!raw || isTestKey)) {
    return DEFAULT_PRODUCTION_CLERK_PUBLISHABLE_KEY;
  }

  return raw;
}

export const mobileConfig = {
  clerkPublishableKey: resolveClerkPublishableKey(),
  apiBaseUrl: resolvedApiBaseUrl,
};
