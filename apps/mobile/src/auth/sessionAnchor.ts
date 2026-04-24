import * as FileSystem from "expo-file-system/legacy";

/**
 * Lightweight "proof of prior sign-in" stored in the app's document
 * directory. Exists to unblock cold-start when SecureStore is unavailable
 * or the stored JWT is unreadable: if there's no token but an anchor is
 * present, we still know the user has signed in on this device and we
 * can enter the Shell in offline-degraded mode (no remote fetches, but
 * cached content renders). The token remains the source of truth when
 * it's readable — this is a strict fallback.
 *
 * We deliberately don't use SecureStore for this: the whole point is to
 * survive the exact failure modes that affect SecureStore cold-start.
 * `documentDirectory` is non-secure but always readable after the app
 * starts, and is wiped on uninstall — exactly the right lifetime for
 * a sign-in anchor.
 */

export type SessionAnchor = {
  userId: string;
  email: string | null;
  name: string | null;
  plan: string | null;
  targetLanguages: string[];
  booksCount: number;
  storiesCount: number;
  savedAt: string;
};

const ANCHOR_PATH = `${FileSystem.documentDirectory ?? ""}digital-polyglot/session-anchor.json`;

async function ensureParentDirectory(): Promise<void> {
  const parent = `${FileSystem.documentDirectory ?? ""}digital-polyglot`;
  const info = await FileSystem.getInfoAsync(parent);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(parent, { intermediates: true });
  }
}

export async function saveSessionAnchor(anchor: SessionAnchor): Promise<void> {
  try {
    await ensureParentDirectory();
    await FileSystem.writeAsStringAsync(ANCHOR_PATH, JSON.stringify(anchor));
  } catch {
    // Best-effort only. Losing the anchor just means the next offline
    // cold-start falls back to AuthScreen — the exact scenario we were
    // already in before this module existed.
  }
}

export async function loadSessionAnchor(): Promise<SessionAnchor | null> {
  try {
    const info = await FileSystem.getInfoAsync(ANCHOR_PATH);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(ANCHOR_PATH);
    const parsed = JSON.parse(raw) as Partial<SessionAnchor>;
    if (typeof parsed.userId !== "string" || !parsed.userId) return null;
    return {
      userId: parsed.userId,
      email: typeof parsed.email === "string" ? parsed.email : null,
      name: typeof parsed.name === "string" ? parsed.name : null,
      plan: typeof parsed.plan === "string" ? parsed.plan : null,
      targetLanguages: Array.isArray(parsed.targetLanguages)
        ? parsed.targetLanguages.filter((item): item is string => typeof item === "string")
        : [],
      booksCount: typeof parsed.booksCount === "number" ? parsed.booksCount : 0,
      storiesCount: typeof parsed.storiesCount === "number" ? parsed.storiesCount : 0,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function clearSessionAnchor(): Promise<void> {
  try {
    await FileSystem.deleteAsync(ANCHOR_PATH, { idempotent: true });
  } catch {
    // ignore
  }
}
