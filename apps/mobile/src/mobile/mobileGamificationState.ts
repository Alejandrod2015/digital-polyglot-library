import * as SecureStore from "expo-secure-store";

function getSeenKey(userId?: string | null) {
  return `digital-polyglot/mobile-gamification-seen/${userId ?? "guest"}`;
}

export async function loadSeenGamificationCelebrations(userId?: string | null): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(getSeenKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export async function saveSeenGamificationCelebrations(
  userId: string | null | undefined,
  ids: string[]
): Promise<void> {
  try {
    await SecureStore.setItemAsync(getSeenKey(userId), JSON.stringify(ids.slice(-40)));
  } catch {
    // Fail quietly to avoid breaking the shell.
  }
}
