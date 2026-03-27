import * as SecureStore from "expo-secure-store";

const STORAGE_KEY = "digital-polyglot/mobile-preview-state";

export type ReadingProgress = {
  bookId: string;
  storyId: string;
  title: string;
  updatedAt: string;
  progressRatio?: number;
  currentBlockIndex?: number;
  totalBlocks?: number;
};

export type MobilePreviewState = {
  savedBookIds: string[];
  savedStoryIds: string[];
  readingProgress: ReadingProgress[];
};

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function sanitizeReadingProgress(value: unknown): ReadingProgress[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is ReadingProgress => {
      return (
        typeof item === "object" &&
        item !== null &&
        typeof item.bookId === "string" &&
        typeof item.storyId === "string" &&
        typeof item.title === "string" &&
        typeof item.updatedAt === "string"
      );
    })
    .map((item) => ({
      ...item,
      progressRatio:
        typeof item.progressRatio === "number" && Number.isFinite(item.progressRatio)
          ? Math.min(1, Math.max(0, item.progressRatio))
          : undefined,
      currentBlockIndex:
        typeof item.currentBlockIndex === "number" && Number.isFinite(item.currentBlockIndex)
          ? Math.max(0, Math.floor(item.currentBlockIndex))
          : undefined,
      totalBlocks:
        typeof item.totalBlocks === "number" && Number.isFinite(item.totalBlocks)
          ? Math.max(0, Math.floor(item.totalBlocks))
          : undefined,
    }))
    .slice(0, 8);
}

export async function loadMobilePreviewState(
  fallback: MobilePreviewState
): Promise<MobilePreviewState> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      savedBookIds: sanitizeStringArray(parsed.savedBookIds),
      savedStoryIds: sanitizeStringArray(parsed.savedStoryIds),
      readingProgress: sanitizeReadingProgress(parsed.readingProgress),
    };
  } catch {
    return fallback;
  }
}

export async function saveMobilePreviewState(state: MobilePreviewState): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Preview-mode persistence should fail quietly instead of breaking the app shell.
  }
}
