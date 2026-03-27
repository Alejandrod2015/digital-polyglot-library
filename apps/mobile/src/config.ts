import Constants from "expo-constants";

type ExtraConfig = {
  clerkPublishableKey?: string;
  apiBaseUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;
const DEFAULT_PRODUCTION_APP_URL = "https://reader.digitalpolyglot.com";

function normalizeApiBaseUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.hostname === "localhost") {
      url.hostname = "127.0.0.1";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim() || DEFAULT_PRODUCTION_APP_URL;
  }
}

export const mobileConfig = {
  clerkPublishableKey: extra.clerkPublishableKey?.trim() ?? "",
  apiBaseUrl: normalizeApiBaseUrl(extra.apiBaseUrl?.trim() ?? DEFAULT_PRODUCTION_APP_URL),
};
