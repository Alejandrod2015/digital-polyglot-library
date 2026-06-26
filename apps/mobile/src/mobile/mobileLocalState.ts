import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";

const STORAGE_KEY_LEGACY = "digital-polyglot/mobile-preview-state";

// FileSystem persiste entre reinstalls vía xcodebuild a diferencia de
// SecureStore con dev certs. Reading progress + saved books/stories
// son demasiado importantes para perderlos en cada build.
const PREVIEW_ROOT = `${FileSystem.documentDirectory ?? ""}digital-polyglot`;
const PREVIEW_PATH = `${PREVIEW_ROOT}/preview-state.json`;

async function ensurePreviewRoot(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PREVIEW_ROOT);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PREVIEW_ROOT, { intermediates: true });
  }
}

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

function parseState(raw: string, fallback: MobilePreviewState): MobilePreviewState {
  try {
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

export async function loadMobilePreviewState(
  fallback: MobilePreviewState
): Promise<MobilePreviewState> {
  await ensurePreviewRoot();
  // Path 1: FileSystem (preferido, persiste entre reinstalls).
  try {
    const info = await FileSystem.getInfoAsync(PREVIEW_PATH);
    if (info.exists) {
      const raw = await FileSystem.readAsStringAsync(PREVIEW_PATH);
      return parseState(raw, fallback);
    }
  } catch {
    // ignore, fall through to legacy
  }
  // Path 2: migración desde SecureStore legacy; al primer load, si
  // había estado guardado en la versión vieja, lo rehidratamos al
  // FileSystem y lo devolvemos. Las entries de SecureStore quedan; el
  // FileSystem manda de aquí en adelante.
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY_LEGACY);
    if (raw) {
      const migrated = parseState(raw, fallback);
      await FileSystem.writeAsStringAsync(PREVIEW_PATH, JSON.stringify(migrated));
      return migrated;
    }
  } catch {
    // ignore
  }
  return fallback;
}

export async function saveMobilePreviewState(state: MobilePreviewState): Promise<void> {
  try {
    await ensurePreviewRoot();
    await FileSystem.writeAsStringAsync(PREVIEW_PATH, JSON.stringify(state));
  } catch {
    // Preview-mode persistence should fail quietly instead of breaking the app shell.
  }
}
