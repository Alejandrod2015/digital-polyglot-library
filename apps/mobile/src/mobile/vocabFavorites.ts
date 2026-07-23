import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import { apiFetch } from "../lib/api";
import { mobileConfig } from "../config";

export type MobileFavoriteItem = {
  word: string;
  translation: string;
  wordType?: string | null;
  exampleSentence?: string | null;
  storySlug?: string | null;
  storyTitle?: string | null;
  sourcePath?: string | null;
  language?: string | null;
  nextReviewAt?: string | null;
  lastReviewedAt?: string | null;
  streak?: number | null;
  /** Clip de práctica PRE-HORNEADO para esta palabra, adjuntado por
   *  /api/mobile/favorites cuando la palabra tiene ejercicio en el set de su
   *  historia. Cuando existe, `exampleSentence` ya viene del mismo registro que
   *  el clip → la sección reproduce el audio correcto sin Modal. */
  clipUrl?: string | null;
  /** Clip PRE-HORNEADO de la PALABRA (no la oración), ElevenLabs + gate F0,
   *  adjuntado por /api/mobile/favorites. Alimenta meaning y match sin runtime
   *  ni Modal. Null cuando la palabra no tiene ejercicio meaning con clip. */
  wordClipUrl?: string | null;
  wordVoiceId?: string | null;
  /** Voice the source story was narrated with. Populated by the
   *  /api/mobile/practice/due endpoint for Studio journeys; catalog
   *  stories leave this null so the TTS endpoint falls back to the
   *  language default. */
  voiceId?: string | null;
  /** Synonyms generated alongside the vocab item at story creation time
   *  (0-3 entries, target language). When present, the favorite card
   *  shows them in place of the source story title. Backfill happens in
   *  the story-generation pipeline; until that lands, this field stays
   *  undefined on existing favorites. */
  synonyms?: string[] | null;
};

function getFavoritesKey(userId?: string | null) {
  return `digital-polyglot/mobile-favorites/${userId ?? "guest"}`;
}

export async function loadLocalFavorites(userId?: string | null): Promise<MobileFavoriteItem[]> {
  try {
    const raw = await SecureStore.getItemAsync(getFavoritesKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as MobileFavoriteItem[]) : [];
  } catch {
    return [];
  }
}

export async function saveLocalFavorites(
  userId: string | null | undefined,
  items: MobileFavoriteItem[]
): Promise<void> {
  try {
    await SecureStore.setItemAsync(getFavoritesKey(userId), JSON.stringify(items));
  } catch {
    // Best effort.
  }
}

export async function syncFavoritesFromServer(
  sessionToken: string
): Promise<MobileFavoriteItem[]> {
  return apiFetch<MobileFavoriteItem[]>({
    baseUrl: mobileConfig.apiBaseUrl,
    path: "/api/mobile/favorites",
    token: sessionToken,
  });
}

export async function addFavoriteOnServer(
  sessionToken: string,
  item: MobileFavoriteItem
): Promise<void> {
  await apiFetch({
    baseUrl: mobileConfig.apiBaseUrl,
    path: "/api/mobile/favorites",
    token: sessionToken,
    method: "POST",
    body: item,
  });
}

export async function removeFavoriteOnServer(
  sessionToken: string,
  word: string
): Promise<void> {
  await apiFetch({
    baseUrl: mobileConfig.apiBaseUrl,
    path: "/api/mobile/favorites",
    token: sessionToken,
    method: "DELETE",
    body: { word },
  });
}

export async function updateFavoriteReviewOnServer(
  sessionToken: string,
  args: {
    word: string;
    nextReviewAt: string;
    lastReviewedAt: string;
    streak: number;
  }
): Promise<void> {
  await apiFetch({
    baseUrl: mobileConfig.apiBaseUrl,
    path: "/api/mobile/favorites",
    token: sessionToken,
    method: "PATCH",
    body: args,
  });
}

/**
 * Pending favorite operations queue. When the user adds/removes a word
 * offline (or any time the server call fails), the operation is appended
 * here so it can be replayed when connectivity returns. Without this
 * queue the next `syncFavoritesFromServer` overwrites the local state
 * with the (stale) server payload and the offline edits silently
 * disappear.
 */
export type PendingFavoriteOp =
  | { kind: "add"; item: MobileFavoriteItem; queuedAt: string }
  | { kind: "remove"; word: string; queuedAt: string };

// Legacy SecureStore key; sólo lectura como fallback de migración.
function getPendingKeyLegacy(userId?: string | null) {
  return `digital-polyglot/mobile-favorites-pending/${userId ?? "guest"}`;
}

// FileSystem path (persiste entre reinstalls vía xcodebuild a diferencia
// de SecureStore con dev certs).
const PENDING_ROOT = `${FileSystem.documentDirectory ?? ""}digital-polyglot`;
function getPendingPath(userId?: string | null): string {
  return `${PENDING_ROOT}/pending-favorites-${userId ?? "guest"}.json`;
}

async function ensurePendingRoot(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PENDING_ROOT);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PENDING_ROOT, { intermediates: true });
  }
}

export async function loadPendingFavoriteOps(
  userId?: string | null
): Promise<PendingFavoriteOp[]> {
  await ensurePendingRoot();
  const path = getPendingPath(userId);
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      const raw = await FileSystem.readAsStringAsync(path);
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as PendingFavoriteOp[]) : [];
    }
  } catch {
    // ignore, fall through to legacy
  }
  // Migración: si había queue en SecureStore (versión vieja), la
  // rehidratamos al FileSystem para no perder operaciones pendientes.
  try {
    const raw = await SecureStore.getItemAsync(getPendingKeyLegacy(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      const ops = Array.isArray(parsed) ? (parsed as PendingFavoriteOp[]) : [];
      if (ops.length > 0) {
        await FileSystem.writeAsStringAsync(path, JSON.stringify(ops));
      }
      return ops;
    }
  } catch {
    // ignore
  }
  return [];
}

async function savePendingFavoriteOps(
  userId: string | null | undefined,
  ops: PendingFavoriteOp[]
): Promise<void> {
  try {
    await ensurePendingRoot();
    await FileSystem.writeAsStringAsync(getPendingPath(userId), JSON.stringify(ops));
  } catch {
    // best effort
  }
}

export async function appendPendingFavoriteOp(
  userId: string | null | undefined,
  op: PendingFavoriteOp
): Promise<void> {
  const current = await loadPendingFavoriteOps(userId);
  // Collapse trivially redundant operations: a later add/remove on the
  // same word supersedes earlier ones for that word. Keeps the queue
  // small over long offline sessions without changing the final state.
  const wordKey = op.kind === "add" ? op.item.word.toLowerCase() : op.word.toLowerCase();
  const filtered = current.filter((entry) => {
    const entryWord =
      entry.kind === "add" ? entry.item.word.toLowerCase() : entry.word.toLowerCase();
    return entryWord !== wordKey;
  });
  await savePendingFavoriteOps(userId, [...filtered, op]);
}

/**
 * Replay every pending operation against the server. Returns the list
 * of operations that still failed (and stay queued for the next attempt).
 * Successful ones are removed from disk before this function returns,
 * so an interrupted drain doesn't double-apply on the next try.
 */
export async function drainPendingFavoriteOps(
  sessionToken: string,
  userId: string | null | undefined
): Promise<PendingFavoriteOp[]> {
  const queue = await loadPendingFavoriteOps(userId);
  if (queue.length === 0) return [];
  const stillPending: PendingFavoriteOp[] = [];
  for (const op of queue) {
    try {
      if (op.kind === "add") {
        await addFavoriteOnServer(sessionToken, op.item);
      } else {
        await removeFavoriteOnServer(sessionToken, op.word);
      }
    } catch {
      stillPending.push(op);
    }
  }
  await savePendingFavoriteOps(userId, stillPending);
  return stillPending;
}
