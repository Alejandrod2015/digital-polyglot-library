import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import type { MobileFavoriteItem } from "./vocabFavorites";
import { apiFetch, ApiError } from "../lib/api";
import { mobileConfig } from "../config";

export type FavoriteCollection = {
  id: string;
  name: string;
  /** Each entry is `${language}::${word}` lowercased; matches the
   *  shape returned by `collectionWordKey()` so membership checks are
   *  identity-based and resilient to casing drift. */
  wordKeys: string[];
  createdAt: string;
  /** Canonical language name the collection belongs to ("Spanish",
   *  "German", …). Optional for backward compat; entries created
   *  before this field landed have it undefined and `collectionsForLanguage`
   *  treats them as global until they receive an explicit migration. */
  language?: string;
};

/** Public opts accepted by load/save. With `sessionToken` set the
 *  function syncs with the backend (`/api/collections/*`). Without it,
 *  the function is local-only; same behaviour the file had before the
 *  cloud sync landed. */
export type CollectionsSyncOpts = {
  sessionToken?: string | null;
};

// SecureStore key; sólo se lee como fallback de migración para no
// perder colecciones creadas antes de que pasáramos a FileSystem.
function getCollectionsKeyLegacy(userId?: string | null) {
  return `digital-polyglot/mobile-collections/${userId ?? "guest"}`;
}

// Carpeta donde viven los snapshots offline + journey cache + ahora
// también las colecciones. FileSystem.documentDirectory persiste 100%
// entre reinstalls vía xcodebuild (Keychain a veces no, dependiendo de
// la cert/access group de la firma development), que es lo que hacía
// que las colecciones se "perdieran" tras cada build.
const COLLECTIONS_ROOT = `${FileSystem.documentDirectory ?? ""}digital-polyglot`;

function getCollectionsPath(userId?: string | null): string {
  return `${COLLECTIONS_ROOT}/collections-${userId ?? "guest"}.json`;
}

function getMigrationFlagPath(userId?: string | null): string {
  return `${COLLECTIONS_ROOT}/collections-migrated-${userId ?? "guest"}.flag`;
}

function getDirtyFlagPath(userId?: string | null): string {
  return `${COLLECTIONS_ROOT}/collections-dirty-${userId ?? "guest"}.flag`;
}

function getBackupPath(userId: string | null | undefined, stamp: string): string {
  return `${COLLECTIONS_ROOT}/collections-${userId ?? "guest"}.backup-${stamp}.json`;
}

async function ensureCollectionsRoot(): Promise<void> {
  const info = await FileSystem.getInfoAsync(COLLECTIONS_ROOT);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(COLLECTIONS_ROOT, { intermediates: true });
  }
}

export function collectionWordKey(item: Pick<MobileFavoriteItem, "word" | "language">): string {
  const lang = (item.language ?? "").trim().toLowerCase();
  const word = item.word.trim().toLowerCase();
  return `${lang}::${word}`;
}

function sanitizeCollections(parsed: unknown): FavoriteCollection[] {
  if (!Array.isArray(parsed)) return [];
  return (parsed as FavoriteCollection[]).filter(
    (c) =>
      c &&
      typeof c.id === "string" &&
      typeof c.name === "string" &&
      Array.isArray(c.wordKeys)
  );
}

async function readLocalCollections(userId?: string | null): Promise<FavoriteCollection[]> {
  await ensureCollectionsRoot();
  const path = getCollectionsPath(userId);
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      const raw = await FileSystem.readAsStringAsync(path);
      return sanitizeCollections(JSON.parse(raw));
    }
  } catch {
    // ignore, fall through to legacy
  }
  // SecureStore legacy fallback. Entries left in place so older builds
  // still see them; we just rehydrate to the file on first read.
  try {
    const raw = await SecureStore.getItemAsync(getCollectionsKeyLegacy(userId));
    if (raw) {
      const migrated = sanitizeCollections(JSON.parse(raw));
      if (migrated.length > 0) {
        await FileSystem.writeAsStringAsync(path, JSON.stringify(migrated));
      }
      return migrated;
    }
  } catch {
    // ignore
  }
  return [];
}

async function writeLocalCollections(
  userId: string | null | undefined,
  collections: FavoriteCollection[],
): Promise<void> {
  await ensureCollectionsRoot();
  await FileSystem.writeAsStringAsync(getCollectionsPath(userId), JSON.stringify(collections));
}

async function flagExists(path: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    return info.exists;
  } catch {
    return false;
  }
}

async function writeFlag(path: string, payload: object): Promise<void> {
  try {
    await ensureCollectionsRoot();
    await FileSystem.writeAsStringAsync(path, JSON.stringify(payload));
  } catch {
    /* best-effort */
  }
}

async function clearFlag(path: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) await FileSystem.deleteAsync(path, { idempotent: true });
  } catch {
    /* best-effort */
  }
}

// =============================================================================
// Server I/O; every server response is mirrored back to the local
// file so an offline open still sees the latest known state. Errors
// NEVER throw out the local file; the caller falls back to local.
// =============================================================================

type ServerCollectionResponse = {
  id: string;
  userId: string;
  name: string;
  language: string | null;
  wordKeys: string[];
  createdAt: string;
  updatedAt: string;
};

function fromServer(c: ServerCollectionResponse): FavoriteCollection {
  return {
    id: c.id,
    name: c.name,
    wordKeys: Array.isArray(c.wordKeys) ? c.wordKeys : [],
    createdAt: typeof c.createdAt === "string" ? c.createdAt : new Date().toISOString(),
    ...(c.language ? { language: c.language } : {}),
  };
}

async function listFromServer(sessionToken: string): Promise<FavoriteCollection[]> {
  const res = await apiFetch<{ collections: ServerCollectionResponse[] }>({
    baseUrl: mobileConfig.apiBaseUrl,
    path: "/api/collections",
    token: sessionToken,
  });
  return (res.collections ?? []).map(fromServer);
}

async function bulkSync(
  sessionToken: string,
  collections: FavoriteCollection[],
): Promise<FavoriteCollection[]> {
  const res = await apiFetch<{ collections: ServerCollectionResponse[] }>({
    baseUrl: mobileConfig.apiBaseUrl,
    path: "/api/collections/sync",
    token: sessionToken,
    method: "POST",
    body: { collections },
  });
  return (res.collections ?? []).map(fromServer);
}

/**
 * Delete a collection on the server. Exposed because the bulk sync
 * endpoint is upsert-only (no tombstones), so a deletion done purely
 * in the local file would be undone by the next `loadCollections`
 * fetch. Callers should pair this with a local removal + persist.
 *
 * Throws on network / auth errors; the caller decides whether to
 * roll back the local UI or surface the error.
 */
export async function deleteCollectionOnServer(
  sessionToken: string,
  collectionId: string,
): Promise<void> {
  await apiFetch<{ ok: true }>({
    baseUrl: mobileConfig.apiBaseUrl,
    path: `/api/collections/${encodeURIComponent(collectionId)}`,
    token: sessionToken,
    method: "DELETE",
  });
}

// =============================================================================
// Migration; one-time push of pre-cloud local collections into the
// backend. Zero-risk: NEVER deletes the local file; writes a
// timestamped backup BEFORE doing anything mutating; the MIGRATION_OK
// flag is the LAST write, so any failure mid-flow leaves the flag
// absent and we retry on the next load.
// =============================================================================

async function migrateIfNeeded(
  userId: string | null | undefined,
  sessionToken: string,
  local: FavoriteCollection[],
): Promise<FavoriteCollection[] | null> {
  const flagPath = getMigrationFlagPath(userId);
  if (await flagExists(flagPath)) return null;

  // Persistent backup BEFORE any potentially-mutating step. The
  // backup file stays on disk forever (tiny JSON); we'd rather
  // accumulate one per migration attempt than lose a single byte of
  // user data to an unexpected merge.
  if (local.length > 0) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    try {
      await FileSystem.writeAsStringAsync(
        getBackupPath(userId, stamp),
        JSON.stringify(local),
      );
    } catch {
      // Backup write failed → abort migration. Local file untouched.
      return null;
    }
  }

  // Push local snapshot to backend. The endpoint set-unions wordKeys
  // with any rows the web may already have created under the same
  // Clerk userId, so we never drop entries from either side.
  let merged: FavoriteCollection[];
  try {
    merged = await bulkSync(sessionToken, local);
  } catch {
    // Auth or network failure → flag stays absent, retry next time.
    return null;
  }

  // Overwrite the canonical local file with the authoritative merged
  // state. Done BEFORE the flag write so a crash here leaves the
  // collections intact in cache AND triggers a retry of the same
  // (idempotent) bulkSync next session.
  try {
    await writeLocalCollections(userId, merged);
  } catch {
    return null;
  }

  // Mark migration done. Strictly last.
  await writeFlag(flagPath, {
    migratedAt: new Date().toISOString(),
    itemCount: merged.length,
  });

  return merged;
}

// =============================================================================
// Public API. Backward-compatible: callers that don't pass
// `sessionToken` get the original local-only behaviour (offline cache).
// =============================================================================

/**
 * Load the user's collections.
 *
 * - Without `opts.sessionToken`: returns the local cache.
 * - With `opts.sessionToken`:
 *   1. Runs the one-time cloud migration if the MIGRATION_OK flag is
 *      not yet on disk.
 *   2. If the local cache is marked DIRTY from a previous failed
 *      `saveCollections` (e.g. offline edit), pushes local first so
 *      offline edits propagate before the server overwrites them.
 *   3. Otherwise fetches the canonical snapshot from
 *      `GET /api/collections` and writes it to the local cache.
 *   - Any server error falls back to the local cache.
 */
export async function loadCollections(
  userId?: string | null,
  opts?: CollectionsSyncOpts,
): Promise<FavoriteCollection[]> {
  const local = await readLocalCollections(userId);

  const token = opts?.sessionToken ?? null;
  if (!token) return local;

  // Migration first. Idempotent (no-ops once the flag is on disk).
  const migrated = await migrateIfNeeded(userId, token, local);
  if (migrated) return migrated;

  // Local has pending edits that never made it to the server (offline
  // / network failure during a prior save). Push local first so those
  // edits aren't overwritten by the server fetch below.
  const dirtyPath = getDirtyFlagPath(userId);
  if (await flagExists(dirtyPath)) {
    try {
      const merged = await bulkSync(token, local);
      await writeLocalCollections(userId, merged);
      await clearFlag(dirtyPath);
      return merged;
    } catch {
      // Still can't reach the server → keep dirty flag, return local.
      return local;
    }
  }

  // Plain fetch.
  try {
    const server = await listFromServer(token);
    await writeLocalCollections(userId, server);
    return server;
  } catch (err) {
    // 401 → token is stale; nothing to do here, surface local.
    // Anything else → also surface local (offline-tolerant).
    if (err instanceof ApiError && err.status === 401) {
      return local;
    }
    return local;
  }
}

/**
 * Persist the user's collections.
 *
 * - Always writes the local cache first (offline safety net).
 * - With `opts.sessionToken`: pushes the full set to
 *   `POST /api/collections/sync` (idempotent set-union on the server).
 * - On server error: writes a DIRTY flag so the next `loadCollections`
 *   call retries the push before fetching anything from the server.
 *   This is how offline edits eventually reach the backend without a
 *   per-mutation queue.
 */
export async function saveCollections(
  userId: string | null | undefined,
  collections: FavoriteCollection[],
  opts?: CollectionsSyncOpts,
): Promise<void> {
  try {
    await writeLocalCollections(userId, collections);
  } catch {
    /* best-effort; local cache */
  }

  const token = opts?.sessionToken ?? null;
  if (!token) return;

  try {
    const merged = await bulkSync(token, collections);
    // Server may have keys we didn't (e.g. another device added one
    // mid-flight). Mirror that back so we don't lose it on next read.
    try {
      await writeLocalCollections(userId, merged);
    } catch {
      /* best-effort */
    }
    // Successful sync → clear any prior dirty flag.
    await clearFlag(getDirtyFlagPath(userId));
  } catch {
    // Sync failed. Mark dirty so the next load re-pushes before
    // fetching, preserving the offline edits.
    await writeFlag(getDirtyFlagPath(userId), {
      dirtyAt: new Date().toISOString(),
    });
  }
}

export function createCollection(name: string, language?: string | null): FavoriteCollection {
  return {
    id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    wordKeys: [],
    createdAt: new Date().toISOString(),
    language: language?.trim() || undefined,
  };
}

/**
 * Filter collections that belong to the given language. Collections
 * without an explicit `language` field (legacy entries) are inferred
 * from their wordKeys; if every word in the collection is from the
 * same language we treat that as the collection's language; otherwise
 * the collection is treated as global and shown across all journeys.
 */
export function collectionsForLanguage(
  collections: FavoriteCollection[],
  language: string | null | undefined
): FavoriteCollection[] {
  if (!language) return collections;
  const target = language.trim().toLowerCase();
  return collections.filter((c) => {
    if (c.language) return c.language.trim().toLowerCase() === target;
    if (c.wordKeys.length === 0) return true;
    const langs = new Set(c.wordKeys.map((k) => k.split("::")[0] ?? ""));
    if (langs.size === 1) {
      return langs.has(target);
    }
    return true;
  });
}

export function isItemInCollection(
  collection: FavoriteCollection,
  item: Pick<MobileFavoriteItem, "word" | "language">
): boolean {
  return collection.wordKeys.includes(collectionWordKey(item));
}

export function addItemToCollection(
  collection: FavoriteCollection,
  item: Pick<MobileFavoriteItem, "word" | "language">
): FavoriteCollection {
  const key = collectionWordKey(item);
  if (collection.wordKeys.includes(key)) return collection;
  return { ...collection, wordKeys: [...collection.wordKeys, key] };
}

export function removeItemFromCollection(
  collection: FavoriteCollection,
  item: Pick<MobileFavoriteItem, "word" | "language">
): FavoriteCollection {
  const key = collectionWordKey(item);
  return { ...collection, wordKeys: collection.wordKeys.filter((k) => k !== key) };
}
