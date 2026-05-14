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
};

function getCollectionsKey(userId?: string | null) {
  return `digital-polyglot/mobile-collections/${userId ?? "guest"}`;
}

export function collectionWordKey(item: Pick<MobileFavoriteItem, "word" | "language">): string {
  const lang = (item.language ?? "").trim().toLowerCase();
  const word = item.word.trim().toLowerCase();
  return `${lang}::${word}`;
}

export async function loadCollections(userId?: string | null): Promise<FavoriteCollection[]> {
  try {
    const raw = await SecureStore.getItemAsync(getCollectionsKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as FavoriteCollection[]) : [];
  } catch {
    return [];
  }
}

export async function saveCollections(
  userId: string | null | undefined,
  collections: FavoriteCollection[]
): Promise<void> {
  try {
    await SecureStore.setItemAsync(getCollectionsKey(userId), JSON.stringify(collections));
  } catch {
    /* best-effort — local cache, server sync not in v1 */
  }
}

export function createCollection(name: string): FavoriteCollection {
  return {
    id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    wordKeys: [],
    createdAt: new Date().toISOString(),
  };
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
