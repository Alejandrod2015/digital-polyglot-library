import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import type { MobileFavoriteItem } from "./vocabFavorites";

export type FavoriteCollection = {
  id: string;
  name: string;
  /** Each entry is `${language}::${word}` lowercased; matches the
   *  shape returned by `collectionWordKey()` so membership checks are
   *  identity-based and resilient to casing drift. */
  wordKeys: string[];
  createdAt: string;
  /** Canonical language name the collection belongs to ("Spanish",
   *  "German", …). Optional for backward compat — entries created
   *  before this field landed have it undefined and `collectionsForLanguage`
   *  treats them as global until they receive an explicit migration. */
  language?: string;
};

// SecureStore key — sólo se lee como fallback de migración para no
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

export async function loadCollections(userId?: string | null): Promise<FavoriteCollection[]> {
  await ensureCollectionsRoot();
  const path = getCollectionsPath(userId);
  // Path 1 (preferido): FileSystem. Persiste entre reinstalls.
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      const raw = await FileSystem.readAsStringAsync(path);
      return sanitizeCollections(JSON.parse(raw));
    }
  } catch {
    // ignore, fall through to legacy
  }
  // Path 2 (migración una vez): SecureStore legacy. Si encontramos
  // datos ahí, los rehidratamos al FileSystem y los devolvemos. Las
  // entries de SecureStore quedan como están (no las borramos para no
  // sorprender a builds viejos que aún corren).
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

export async function saveCollections(
  userId: string | null | undefined,
  collections: FavoriteCollection[]
): Promise<void> {
  try {
    await ensureCollectionsRoot();
    await FileSystem.writeAsStringAsync(getCollectionsPath(userId), JSON.stringify(collections));
  } catch {
    /* best-effort — local cache, server sync not in v1 */
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
 * from their wordKeys — if every word in the collection is from the
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
