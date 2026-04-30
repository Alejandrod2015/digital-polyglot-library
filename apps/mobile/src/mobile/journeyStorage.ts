import * as FileSystem from "expo-file-system/legacy";
import { dedupeJourneysById, type Journey } from "./journeys";

/**
 * Local-disk persistence for the user's `journeys` list. The server
 * doesn't yet model multi-variant journeys (it only stores the
 * deduped `targetLanguages` + a single `preferredVariant`), so on
 * app cold-start the synthesized journey list collapses to one
 * journey per language. To preserve the user's multi-variant picks
 * across app kills, we shadow-save the canonical `journeys[]` here
 * and restore it on hydrate. The server payload still drives every
 * other preference.
 *
 * Stored as a JSON file in the user's documents directory (parallel
 * to the offline-stories cache).
 */

const STORAGE_FILE = `${FileSystem.documentDirectory ?? ""}journeys.json`;

type StoredPayload = {
  version: 1;
  journeys: Journey[];
  activeJourneyId: string | null;
  savedAt: string;
};

export async function saveStoredJourneys(
  journeys: Journey[],
  activeJourneyId: string | null
): Promise<void> {
  if (!FileSystem.documentDirectory) return;
  // Dedupe before persisting so the disk file is the source of
  // truth for "no duplicates" — even if some upstream caller sent
  // a dirty array, the file we write will be clean and the next
  // hydrate will be too.
  const cleanJourneys = dedupeJourneysById(journeys);
  const payload: StoredPayload = {
    version: 1,
    journeys: cleanJourneys,
    activeJourneyId,
    savedAt: new Date().toISOString(),
  };
  try {
    await FileSystem.writeAsStringAsync(STORAGE_FILE, JSON.stringify(payload));
  } catch (err) {
    // Non-fatal — the next save will retry. If disk is full or the
    // path is unwritable the user just loses multi-variant restore
    // on next app open, which falls back to the synthesized list.
    console.warn("[journey-storage] save failed", err);
  }
}

export async function loadStoredJourneys(): Promise<{
  journeys: Journey[];
  activeJourneyId: string | null;
} | null> {
  if (!FileSystem.documentDirectory) return null;
  try {
    const info = await FileSystem.getInfoAsync(STORAGE_FILE);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(STORAGE_FILE);
    const parsed = JSON.parse(raw) as StoredPayload;
    if (
      !parsed ||
      parsed.version !== 1 ||
      !Array.isArray(parsed.journeys)
    ) {
      return null;
    }
    // Auto-cure: any historical duplicates left in the file from
    // older app versions get collapsed at hydrate time, so users
    // who already have two of the same journey on disk start
    // seeing a single entry on the next cold start without us
    // needing to ship a migration.
    const cleanJourneys = dedupeJourneysById(parsed.journeys);
    return {
      journeys: cleanJourneys,
      activeJourneyId: parsed.activeJourneyId ?? null,
    };
  } catch {
    return null;
  }
}

export async function clearStoredJourneys(): Promise<void> {
  if (!FileSystem.documentDirectory) return;
  try {
    const info = await FileSystem.getInfoAsync(STORAGE_FILE);
    if (info.exists) {
      await FileSystem.deleteAsync(STORAGE_FILE, { idempotent: true });
    }
  } catch {
    /* swallow — clearing is best-effort */
  }
}
