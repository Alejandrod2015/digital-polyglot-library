import * as SecureStore from "expo-secure-store";

const MOBILE_SESSION_KEY = "digital-polyglot/mobile-session-token";

export type MobileSessionPayload = {
  aud: "digital-polyglot-mobile";
  sub: string;
  email: string | null;
  name: string | null;
  plan: string | null;
  targetLanguages: string[];
  booksCount: number;
  storiesCount: number;
  iat: number;
  exp: number;
};

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return globalThis.atob(padded);
}

export function decodeMobileSessionToken(token: string): MobileSessionPayload | null {
  const [, payload] = token.split(".");
  if (!payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as Partial<MobileSessionPayload>;
    if (
      parsed.aud !== "digital-polyglot-mobile" ||
      typeof parsed.sub !== "string" ||
      typeof parsed.iat !== "number" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }

    return {
      aud: "digital-polyglot-mobile",
      sub: parsed.sub,
      email: typeof parsed.email === "string" ? parsed.email : null,
      name: typeof parsed.name === "string" ? parsed.name : null,
      plan: typeof parsed.plan === "string" ? parsed.plan : null,
      targetLanguages: Array.isArray(parsed.targetLanguages)
        ? parsed.targetLanguages.filter((item): item is string => typeof item === "string")
        : [],
      booksCount: typeof parsed.booksCount === "number" ? parsed.booksCount : 0,
      storiesCount: typeof parsed.storiesCount === "number" ? parsed.storiesCount : 0,
      iat: parsed.iat,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export async function loadMobileSessionToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(MOBILE_SESSION_KEY);
  } catch {
    return null;
  }
}

export async function saveMobileSessionToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(MOBILE_SESSION_KEY, token);
  } catch {
    // Keep preview mode available even if secure storage is unavailable.
  }
}

export async function clearMobileSessionToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(MOBILE_SESSION_KEY);
  } catch {
    // Best effort.
  }
}
