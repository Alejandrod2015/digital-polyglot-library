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
